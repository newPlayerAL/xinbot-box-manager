use std::{convert::Infallible, net::SocketAddr, path::Path as FsPath, time::Duration};

use axum::{
    extract::{ConnectInfo, DefaultBodyLimit, Path, State},
    http::{header, HeaderMap, HeaderValue, StatusCode},
    response::{
        sse::{Event, KeepAlive},
        IntoResponse, Response, Sse,
    },
    routing::{get, post},
    Json, Router,
};
use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use serde_json::json;
use tokio_stream::wrappers::BroadcastStream;

use crate::{
    auth::AuthService,
    error::{ApiError, ApiResult},
    models::{GlobalSettings, InstanceProfile, SettingsView},
    plugins,
    process::ProcessManager,
    store::Store,
};

const INDEX_HTML: &str = include_str!("../web/index.html");
const APP_JS: &str = include_str!("../web/app.js");
const STYLES_CSS: &str = include_str!("../web/styles.css");

#[derive(Clone)]
pub struct AppState {
    pub store: Store,
    pub auth: AuthService,
    pub processes: ProcessManager,
}

pub fn router(state: AppState) -> Router {
    Router::new()
        .route("/", get(index))
        .route("/app.js", get(app_js))
        .route("/styles.css", get(styles_css))
        .route("/api/auth/status", get(auth_status))
        .route("/api/auth/setup", post(auth_setup))
        .route("/api/auth/login", post(auth_login))
        .route("/api/auth/logout", post(auth_logout))
        .route("/api/auth/change-password", post(auth_change_password))
        .route("/api/settings", get(get_settings).put(update_settings))
        .route("/api/plugins", get(list_plugins))
        .route("/api/instances", get(list_instances).post(create_instance))
        .route(
            "/api/instances/:id",
            get(get_instance)
                .put(update_instance)
                .delete(delete_instance),
        )
        .route("/api/instances/:id/start", post(start_instance))
        .route("/api/instances/:id/stop", post(stop_instance))
        .route("/api/instances/:id/restart", post(restart_instance))
        .route("/api/instances/:id/command", post(send_command))
        .route("/api/instances/:id/logs", get(instance_logs))
        .route(
            "/api/instances/:id/plugin-config/:plugin_id/:file_name",
            get(read_plugin_config).put(write_plugin_config),
        )
        .route("/api/runtime", get(runtime_status))
        .route("/api/events", get(events))
        .layer(DefaultBodyLimit::max(1024 * 1024))
        .fallback(not_found)
        .with_state(state)
}

async fn index() -> Response {
    static_response("text/html; charset=utf-8", INDEX_HTML)
}

async fn app_js() -> Response {
    static_response("text/javascript; charset=utf-8", APP_JS)
}

async fn styles_css() -> Response {
    static_response("text/css; charset=utf-8", STYLES_CSS)
}

fn static_response(content_type: &'static str, body: &'static str) -> Response {
    let mut response = ([(header::CONTENT_TYPE, content_type)], body).into_response();
    let headers = response.headers_mut();
    headers.insert(
        header::CACHE_CONTROL,
        HeaderValue::from_static("no-cache, no-store, must-revalidate"),
    );
    headers.insert(
        header::X_CONTENT_TYPE_OPTIONS,
        HeaderValue::from_static("nosniff"),
    );
    headers.insert(
        header::CONTENT_SECURITY_POLICY,
        HeaderValue::from_static(
            "default-src 'self'; connect-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
        ),
    );
    response
}

async fn not_found() -> ApiError {
    ApiError::not_found("接口或页面不存在")
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct AuthStatus {
    configured: bool,
    authenticated: bool,
    username: Option<String>,
}

async fn auth_status(State(state): State<AppState>, headers: HeaderMap) -> Json<AuthStatus> {
    let username = state.auth.authenticated_username(&headers);
    Json(AuthStatus {
        configured: state.auth.is_configured(),
        authenticated: username.is_some(),
        username,
    })
}

#[derive(Deserialize)]
struct Credentials {
    username: String,
    password: String,
}

async fn auth_setup(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<Credentials>,
) -> ApiResult<Response> {
    require_csrf(&headers)?;
    let auth = state.auth.clone();
    let token =
        tokio::task::spawn_blocking(move || auth.setup(&payload.username, &payload.password))
            .await
            .map_err(|_| ApiError::internal("账号设置任务异常结束"))?
            .map_err(ApiError::conflict)?;
    session_response(&state.auth, token)
}

async fn auth_login(
    State(state): State<AppState>,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    Json(payload): Json<Credentials>,
) -> ApiResult<Response> {
    require_csrf(&headers)?;
    let auth = state.auth.clone();
    let peer = peer.ip().to_string();
    let token = tokio::task::spawn_blocking(move || {
        auth.login(&payload.username, &payload.password, &peer)
    })
    .await
    .map_err(|_| ApiError::internal("登录任务异常结束"))?
    .map_err(|message| ApiError::new(StatusCode::UNAUTHORIZED, message))?;
    session_response(&state.auth, token)
}

async fn auth_logout(State(state): State<AppState>, headers: HeaderMap) -> ApiResult<Response> {
    require_csrf(&headers)?;
    state.auth.logout(&headers);
    let mut response = Json(json!({ "ok": true })).into_response();
    response.headers_mut().insert(
        header::SET_COOKIE,
        HeaderValue::from_str(&state.auth.expired_cookie())
            .map_err(|_| ApiError::internal("无法生成退出 Cookie"))?,
    );
    Ok(response)
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ChangePasswordRequest {
    current_password: String,
    username: String,
    new_password: String,
}

async fn auth_change_password(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<ChangePasswordRequest>,
) -> ApiResult<Response> {
    require_csrf(&headers)?;
    require_auth(&state, &headers)?;
    let auth = state.auth.clone();
    let token = tokio::task::spawn_blocking(move || {
        auth.change_credentials(
            &payload.current_password,
            &payload.username,
            &payload.new_password,
        )
    })
    .await
    .map_err(|_| ApiError::internal("账号修改任务异常结束"))?
    .map_err(ApiError::bad_request)?;
    session_response(&state.auth, token)
}

fn session_response(auth: &AuthService, token: String) -> ApiResult<Response> {
    let mut response = Json(json!({ "ok": true })).into_response();
    response.headers_mut().insert(
        header::SET_COOKIE,
        HeaderValue::from_str(&auth.cookie_for(&token))
            .map_err(|_| ApiError::internal("无法生成登录 Cookie"))?,
    );
    Ok(response)
}

async fn get_settings(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> ApiResult<Json<SettingsView>> {
    require_auth(&state, &headers)?;
    let settings = state.store.load_settings().map_err(ApiError::internal)?;
    Ok(Json(settings_view(settings)))
}

async fn update_settings(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(mut settings): Json<GlobalSettings>,
) -> ApiResult<Json<SettingsView>> {
    require_csrf(&headers)?;
    require_auth(&state, &headers)?;
    settings
        .normalize_and_validate()
        .map_err(ApiError::bad_request)?;
    state
        .store
        .save_settings(&settings)
        .map_err(ApiError::internal)?;
    Ok(Json(settings_view(settings)))
}

fn settings_view(settings: GlobalSettings) -> SettingsView {
    let xinbot_ready = FsPath::new(&settings.xinbot_jar).is_file();
    let resource_dir_ready = FsPath::new(&settings.resource_dir)
        .join("catalog.json")
        .is_file();
    SettingsView {
        settings,
        xinbot_ready,
        resource_dir_ready,
    }
}

async fn list_plugins(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> ApiResult<Json<Vec<plugins::PluginDescriptor>>> {
    require_auth(&state, &headers)?;
    let settings = state.store.load_settings().map_err(ApiError::internal)?;
    let plugins = plugins::collect_plugins(&settings).map_err(ApiError::bad_request)?;
    Ok(Json(plugins))
}

async fn list_instances(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> ApiResult<Json<Vec<InstanceProfile>>> {
    require_auth(&state, &headers)?;
    Ok(Json(
        state.store.list_instances().map_err(ApiError::internal)?,
    ))
}

async fn get_instance(
    State(state): State<AppState>,
    Path(id): Path<String>,
    headers: HeaderMap,
) -> ApiResult<Json<InstanceProfile>> {
    require_auth(&state, &headers)?;
    state
        .store
        .get_instance(&id)
        .map(Json)
        .map_err(ApiError::not_found)
}

async fn create_instance(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(mut profile): Json<InstanceProfile>,
) -> ApiResult<(StatusCode, Json<InstanceProfile>)> {
    require_csrf(&headers)?;
    require_auth(&state, &headers)?;
    profile
        .normalize_and_validate()
        .map_err(ApiError::bad_request)?;
    let settings = state.store.load_settings().map_err(ApiError::internal)?;
    plugins::validate_server_adapter(&profile, &settings).map_err(ApiError::bad_request)?;
    let profile = state
        .store
        .create_instance(profile)
        .map_err(ApiError::bad_request)?;
    Ok((StatusCode::CREATED, Json(profile)))
}

async fn update_instance(
    State(state): State<AppState>,
    Path(id): Path<String>,
    headers: HeaderMap,
    Json(mut profile): Json<InstanceProfile>,
) -> ApiResult<Json<InstanceProfile>> {
    require_csrf(&headers)?;
    require_auth(&state, &headers)?;
    if state.processes.is_running(&id) {
        return Err(ApiError::conflict("请先停止实例再修改配置"));
    }
    profile.id = id.clone();
    profile
        .normalize_and_validate()
        .map_err(ApiError::bad_request)?;
    let settings = state.store.load_settings().map_err(ApiError::internal)?;
    plugins::validate_server_adapter(&profile, &settings).map_err(ApiError::bad_request)?;
    let profile = state
        .store
        .update_instance(&id, profile)
        .map_err(ApiError::bad_request)?;
    Ok(Json(profile))
}

async fn delete_instance(
    State(state): State<AppState>,
    Path(id): Path<String>,
    headers: HeaderMap,
) -> ApiResult<Json<serde_json::Value>> {
    require_csrf(&headers)?;
    require_auth(&state, &headers)?;
    if state.processes.is_running(&id) {
        return Err(ApiError::conflict("请先停止实例再删除"));
    }
    state
        .store
        .move_instance_to_trash(&id)
        .map_err(ApiError::bad_request)?;
    Ok(Json(json!({ "ok": true, "recoverable": true })))
}

async fn start_instance(
    State(state): State<AppState>,
    Path(id): Path<String>,
    headers: HeaderMap,
) -> ApiResult<Json<serde_json::Value>> {
    require_csrf(&headers)?;
    require_auth(&state, &headers)?;
    let profile = state.store.get_instance(&id).map_err(ApiError::not_found)?;
    let settings = state.store.load_settings().map_err(ApiError::internal)?;
    let processes = state.processes.clone();
    tokio::task::spawn_blocking(move || processes.start(profile, settings))
        .await
        .map_err(|_| ApiError::internal("启动任务异常结束"))?
        .map_err(ApiError::bad_request)?;
    Ok(Json(json!({ "ok": true })))
}

async fn stop_instance(
    State(state): State<AppState>,
    Path(id): Path<String>,
    headers: HeaderMap,
) -> ApiResult<Json<serde_json::Value>> {
    require_csrf(&headers)?;
    require_auth(&state, &headers)?;
    state.processes.stop(&id).map_err(ApiError::bad_request)?;
    Ok(Json(json!({ "ok": true })))
}

async fn restart_instance(
    State(state): State<AppState>,
    Path(id): Path<String>,
    headers: HeaderMap,
) -> ApiResult<Json<serde_json::Value>> {
    require_csrf(&headers)?;
    require_auth(&state, &headers)?;
    let profile = state.store.get_instance(&id).map_err(ApiError::not_found)?;
    let settings = state.store.load_settings().map_err(ApiError::internal)?;
    let processes = state.processes.clone();
    tokio::task::spawn_blocking(move || processes.restart(profile, settings))
        .await
        .map_err(|_| ApiError::internal("重启任务异常结束"))?
        .map_err(ApiError::bad_request)?;
    Ok(Json(json!({ "ok": true })))
}

#[derive(Deserialize)]
struct CommandRequest {
    command: String,
}

async fn send_command(
    State(state): State<AppState>,
    Path(id): Path<String>,
    headers: HeaderMap,
    Json(payload): Json<CommandRequest>,
) -> ApiResult<Json<serde_json::Value>> {
    require_csrf(&headers)?;
    require_auth(&state, &headers)?;
    state
        .processes
        .send_command(&id, &payload.command)
        .map_err(ApiError::bad_request)?;
    Ok(Json(json!({ "ok": true })))
}

async fn instance_logs(
    State(state): State<AppState>,
    Path(id): Path<String>,
    headers: HeaderMap,
) -> ApiResult<Json<Vec<crate::process::LogLine>>> {
    require_auth(&state, &headers)?;
    state.store.get_instance(&id).map_err(ApiError::not_found)?;
    Ok(Json(state.processes.recent_logs(&id)))
}

async fn read_plugin_config(
    State(state): State<AppState>,
    Path((id, plugin_id, file_name)): Path<(String, String, String)>,
    headers: HeaderMap,
) -> ApiResult<Json<plugins::PluginConfigDocument>> {
    require_auth(&state, &headers)?;
    let profile = state.store.get_instance(&id).map_err(ApiError::not_found)?;
    let settings = state.store.load_settings().map_err(ApiError::internal)?;
    let work_dir = state.store.work_dir(&id).map_err(ApiError::bad_request)?;
    plugins::read_plugin_config(&profile, &settings, &work_dir, &plugin_id, &file_name)
        .map(Json)
        .map_err(ApiError::bad_request)
}

#[derive(Deserialize)]
struct PluginConfigContent {
    content: String,
}

async fn write_plugin_config(
    State(state): State<AppState>,
    Path((id, plugin_id, file_name)): Path<(String, String, String)>,
    headers: HeaderMap,
    Json(payload): Json<PluginConfigContent>,
) -> ApiResult<Json<plugins::PluginConfigDocument>> {
    require_csrf(&headers)?;
    require_auth(&state, &headers)?;
    if state.processes.is_running(&id) {
        return Err(ApiError::conflict("请先停止实例再修改插件配置"));
    }
    let profile = state.store.get_instance(&id).map_err(ApiError::not_found)?;
    let settings = state.store.load_settings().map_err(ApiError::internal)?;
    let work_dir = state.store.work_dir(&id).map_err(ApiError::bad_request)?;
    plugins::write_plugin_config(
        &profile,
        &settings,
        &work_dir,
        &plugin_id,
        &file_name,
        &payload.content,
    )
    .map(Json)
    .map_err(ApiError::bad_request)
}

async fn runtime_status(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> ApiResult<Json<Vec<crate::models::RuntimeStatus>>> {
    require_auth(&state, &headers)?;
    Ok(Json(state.processes.statuses()))
}

async fn events(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> ApiResult<Sse<impl futures_util::Stream<Item = Result<Event, Infallible>>>> {
    require_auth(&state, &headers)?;
    let receiver = state.processes.subscribe();
    let stream = BroadcastStream::new(receiver).filter_map(|message| async move {
        match message {
            Ok(message) => Some(Ok(Event::default()
                .json_data(message)
                .unwrap_or_else(|_| Event::default().data("{\"type\":\"invalid\"}")))),
            Err(_) => None,
        }
    });
    Ok(Sse::new(stream).keep_alive(
        KeepAlive::new()
            .interval(Duration::from_secs(15))
            .text("keep-alive"),
    ))
}

fn require_auth(state: &AppState, headers: &HeaderMap) -> ApiResult<String> {
    state
        .auth
        .authenticated_username(headers)
        .ok_or_else(ApiError::unauthorized)
}

fn require_csrf(headers: &HeaderMap) -> ApiResult<()> {
    let valid = headers
        .get("x-xinbot-request")
        .and_then(|value| value.to_str().ok())
        == Some("1");
    if valid {
        Ok(())
    } else {
        Err(ApiError::new(StatusCode::FORBIDDEN, "请求缺少安全标记"))
    }
}
