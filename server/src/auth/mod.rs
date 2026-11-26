mod password;

use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use rand::{thread_rng, RngCore};
use sha2::{Digest, Sha256};
use subtle::ConstantTimeEq;

pub use password::{hash_password, verify_password};

pub fn new_user_id() -> String {
    let mut bytes = [0u8; 16];
    thread_rng().fill_bytes(&mut bytes);
    bytes.iter().map(|byte| format!("{byte:02x}")).collect()
}

pub fn new_token() -> String {
    let mut bytes = [0u8; 32];
    thread_rng().fill_bytes(&mut bytes);
    URL_SAFE_NO_PAD.encode(bytes)
}

pub fn sha256_hex(input: &str) -> String {
    let digest = Sha256::digest(input.as_bytes());
    let mut out = String::with_capacity(64);
    for byte in digest {
        out.push_str(&format!("{byte:02x}"));
    }
    out
}

pub fn constant_time_eq(left: &str, right: &str) -> bool {
    left.as_bytes().ct_eq(right.as_bytes()).into()
}

pub fn normalize_username(username: &str) -> String {
    username.trim().to_lowercase()
}
