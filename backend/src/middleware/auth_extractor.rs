use axum::{
    extract::{FromRef, FromRequestParts},
    http::{request::Parts, StatusCode},
};

use crate::{auth::decode_jwt, models::User, AppState};

// Authenticated user extractor for protected routes.
#[derive(Debug, Clone)]
pub struct AuthUser(pub User);

impl<S> FromRequestParts<S> for AuthUser
where
    S: Send + Sync,
    AppState: FromRef<S>,
{
    type Rejection = (StatusCode, &'static str);

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        let app_state = AppState::from_ref(state);

        let auth_header = parts
            .headers
            .get("authorization")
            .and_then(|v| v.to_str().ok())
            .ok_or((StatusCode::UNAUTHORIZED, "missing authorization header"))?;

        let token = auth_header
            .strip_prefix("Bearer ")
            .ok_or((StatusCode::UNAUTHORIZED, "invalid auth scheme"))?;

        let claims = decode_jwt(token, &app_state.jwt_secret)
            .map_err(|_| (StatusCode::UNAUTHORIZED, "invalid token"))?;

        let user = sqlx::query_as::<_, User>(
            "SELECT id, username, password_hash, is_guest, created_at FROM users WHERE id = ?",
        )
        .bind(claims.sub)
        .fetch_optional(&app_state.pool)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "db error"))?
        .ok_or((StatusCode::UNAUTHORIZED, "user not found"))?;

        Ok(Self(user))
    }
}
