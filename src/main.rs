mod auth;
mod error;
mod models;
mod plugins;
mod process;
mod store;
mod web;

use std::{
    env, fs,
    io::{self, Write},
    net::SocketAddr,
    path::{Path, PathBuf},
};

use auth::{unix_timestamp, AuthService};
use process::ProcessManager;
use store::Store;
use web::AppState;

#[derive(Debug)]
struct ServeOptions {
    data_dir: PathBuf,
    resource_dir: PathBuf,
    bind: SocketAddr,
    secure_cookie: bool,
}

#[tokio::main]
async fn main() {
    if let Err(error) = run().await {
        eprintln!("错误：{error}");
        std::process::exit(1);
    }
}

async fn run() -> Result<(), String> {
    let args: Vec<String> = env::args().skip(1).collect();
    if args
        .first()
        .is_some_and(|arg| matches!(arg.as_str(), "-h" | "--help"))
    {
        print_help();
        return Ok(());
    }
    if args.first().is_some_and(|arg| arg == "admin") {
        return run_admin(&args[1..]);
    }

    let options = parse_serve_options(&args)?;
    let store = Store::new(options.data_dir.clone(), options.resource_dir.clone())?;
    let auth = AuthService::load(store.auth_path(), options.secure_cookie)?;
    let processes = ProcessManager::new(store.clone());
    let app = web::router(AppState {
        store,
        auth,
        processes: processes.clone(),
    });
    let listener = tokio::net::TcpListener::bind(options.bind)
        .await
        .map_err(|error| format!("无法监听 {}：{error}", options.bind))?;

    println!("XinBot Box Manager 0.1.0");
    println!("管理地址：http://{}", options.bind);
    println!("数据目录：{}", options.data_dir.display());
    if options.bind.ip().is_unspecified() {
        println!("提示：服务正在监听所有网卡，请在首次打开后立即设置管理员账号。");
    }

    let result = axum::serve(
        listener,
        app.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .with_graceful_shutdown(shutdown_signal())
    .await;
    println!("正在停止 XinBot 实例……");
    tokio::task::spawn_blocking(move || processes.shutdown_all())
        .await
        .map_err(|_| "停止实例任务异常结束".to_string())?;
    result.map_err(|error| format!("Web 服务异常退出：{error}"))
}

fn run_admin(args: &[String]) -> Result<(), String> {
    if args.first().map(String::as_str) != Some("reset-password") {
        return Err("用法：xinbot-box-manager admin reset-password [--data-dir PATH]".to_string());
    }
    ensure_privileged_user()?;
    let data_dir = parse_data_dir(&args[1..])?;
    let auth = AuthService::load(data_dir.join("auth.json"), false)?;
    let password = read_password("新管理员密码：")?;
    let confirmation = read_password("再次输入新密码：")?;
    if password != confirmation {
        return Err("两次输入的密码不一致".to_string());
    }
    auth.reset_password(&password)?;
    append_audit(&data_dir, "administrator password reset from Linux console")?;
    println!("管理员密码已重置；已有网页登录会话将失效。");
    Ok(())
}

fn parse_serve_options(args: &[String]) -> Result<ServeOptions, String> {
    let mut index = usize::from(args.first().is_some_and(|arg| arg == "serve"));
    let mut data_dir = env::var_os("XINBOT_BOX_DATA_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("data"));
    let mut resource_dir = default_resource_dir();
    let mut bind = env::var("XINBOT_BOX_BIND").unwrap_or_else(|_| "0.0.0.0:8080".to_string());
    let mut secure_cookie = env::var("XINBOT_BOX_SECURE_COOKIE")
        .map(|value| matches!(value.as_str(), "1" | "true" | "yes"))
        .unwrap_or(false);

    while index < args.len() {
        match args[index].as_str() {
            "--data-dir" => {
                index += 1;
                data_dir = PathBuf::from(
                    args.get(index)
                        .ok_or_else(|| "--data-dir 缺少路径".to_string())?,
                );
            }
            "--resource-dir" => {
                index += 1;
                resource_dir = PathBuf::from(
                    args.get(index)
                        .ok_or_else(|| "--resource-dir 缺少路径".to_string())?,
                );
            }
            "--bind" => {
                index += 1;
                bind = args
                    .get(index)
                    .ok_or_else(|| "--bind 缺少地址".to_string())?
                    .clone();
            }
            "--secure-cookie" => secure_cookie = true,
            other => return Err(format!("未知参数：{other}")),
        }
        index += 1;
    }

    let bind = bind
        .parse::<SocketAddr>()
        .map_err(|_| "监听地址格式无效，应类似 0.0.0.0:8080".to_string())?;
    Ok(ServeOptions {
        data_dir,
        resource_dir,
        bind,
        secure_cookie,
    })
}

fn parse_data_dir(args: &[String]) -> Result<PathBuf, String> {
    let mut data_dir = env::var_os("XINBOT_BOX_DATA_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("data"));
    let mut index = 0;
    while index < args.len() {
        if args[index] != "--data-dir" {
            return Err(format!("未知参数：{}", args[index]));
        }
        index += 1;
        data_dir = PathBuf::from(
            args.get(index)
                .ok_or_else(|| "--data-dir 缺少路径".to_string())?,
        );
        index += 1;
    }
    Ok(data_dir)
}

fn default_resource_dir() -> PathBuf {
    if let Some(path) = env::var_os("XINBOT_BOX_RESOURCE_DIR") {
        return PathBuf::from(path);
    }
    if let Ok(executable) = env::current_exe() {
        if let Some(parent) = executable.parent() {
            let adjacent = parent.join("resources");
            if adjacent.join("catalog.json").is_file() {
                return adjacent;
            }
        }
    }
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("resources")
}

async fn shutdown_signal() {
    if tokio::signal::ctrl_c().await.is_err() {
        eprintln!("无法安装停止信号处理器");
    }
}

#[cfg(unix)]
fn read_password(prompt: &str) -> Result<String, String> {
    use std::{mem::MaybeUninit, os::fd::AsRawFd};

    print!("{prompt}");
    io::stdout()
        .flush()
        .map_err(|error| format!("无法显示密码提示：{error}"))?;
    let stdin = io::stdin();
    let fd = stdin.as_raw_fd();
    let mut original = MaybeUninit::<libc::termios>::uninit();
    if unsafe { libc::tcgetattr(fd, original.as_mut_ptr()) } != 0 {
        return Err("必须在 Linux 终端中交互式重置密码".to_string());
    }
    let original = unsafe { original.assume_init() };
    let mut hidden = original;
    hidden.c_lflag &= !libc::ECHO;
    if unsafe { libc::tcsetattr(fd, libc::TCSANOW, &hidden) } != 0 {
        return Err("无法关闭终端回显".to_string());
    }

    let mut value = String::new();
    let read_result = stdin.read_line(&mut value);
    let restore_result = unsafe { libc::tcsetattr(fd, libc::TCSANOW, &original) };
    println!();
    if restore_result != 0 {
        return Err("无法恢复终端回显".to_string());
    }
    read_result.map_err(|error| format!("无法读取密码：{error}"))?;
    Ok(value.trim_end_matches(['\r', '\n']).to_string())
}

#[cfg(not(unix))]
fn read_password(prompt: &str) -> Result<String, String> {
    print!("{prompt}");
    io::stdout()
        .flush()
        .map_err(|error| format!("无法显示密码提示：{error}"))?;
    let mut value = String::new();
    io::stdin()
        .read_line(&mut value)
        .map_err(|error| format!("无法读取密码：{error}"))?;
    Ok(value.trim_end_matches(['\r', '\n']).to_string())
}

#[cfg(unix)]
fn ensure_privileged_user() -> Result<(), String> {
    let effective_user = unsafe { libc::geteuid() };
    if effective_user == 0 {
        Ok(())
    } else {
        Err("请使用 sudo/root 执行密码重置命令".to_string())
    }
}

#[cfg(not(unix))]
fn ensure_privileged_user() -> Result<(), String> {
    Ok(())
}

fn append_audit(data_dir: &Path, message: &str) -> Result<(), String> {
    fs::create_dir_all(data_dir).map_err(|error| format!("无法创建数据目录：{error}"))?;
    let path = data_dir.join("audit.log");
    let mut options = fs::OpenOptions::new();
    options.create(true).append(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    let mut file = options
        .open(path)
        .map_err(|error| format!("无法写入审计日志：{error}"))?;
    writeln!(file, "{} {message}", unix_timestamp())
        .map_err(|error| format!("无法写入审计日志：{error}"))
}

fn print_help() {
    println!(
        "XinBot Box Manager\n\n\
         用法：\n  \
         xinbot-box-manager [serve] [--bind IP:PORT] [--data-dir PATH] [--resource-dir PATH] [--secure-cookie]\n  \
         sudo xinbot-box-manager admin reset-password [--data-dir PATH]\n\n\
         环境变量：XINBOT_BOX_BIND、XINBOT_BOX_DATA_DIR、XINBOT_BOX_RESOURCE_DIR、XINBOT_BOX_SECURE_COOKIE"
    );
}
