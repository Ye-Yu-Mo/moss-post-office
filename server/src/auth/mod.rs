use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use hmac::{Hmac, Mac};
use rand::{thread_rng, Rng, RngCore};
use sha2::{Digest, Sha256};
use subtle::ConstantTimeEq;

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

pub fn new_nonce() -> String {
    new_token()
}

pub fn new_friend_code() -> String {
    const ALPHABET: &[u8] = b"ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let mut rng = thread_rng();
    (0..6)
        .map(|_| ALPHABET[rng.gen_range(0..ALPHABET.len())] as char)
        .collect()
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

pub fn is_hex_64(value: &str) -> bool {
    value.len() == 64 && value.bytes().all(|byte| byte.is_ascii_hexdigit())
}

/// Proof = HMAC-SHA256(key = verifier, message = nonce), hex encoded.
pub fn verify_proof(verifier_hex: &str, nonce: &str, proof_hex: &str) -> bool {
    let Some(key) = decode_hex(verifier_hex) else {
        return false;
    };
    let Some(proof) = decode_hex(proof_hex) else {
        return false;
    };
    let Ok(mut mac) = Hmac::<Sha256>::new_from_slice(&key) else {
        return false;
    };
    mac.update(nonce.as_bytes());
    mac.verify_slice(&proof).is_ok()
}

fn decode_hex(value: &str) -> Option<Vec<u8>> {
    if value.len() % 2 != 0 {
        return None;
    }
    let bytes = value.as_bytes();
    let mut out = Vec::with_capacity(bytes.len() / 2);
    for pair in bytes.chunks(2) {
        let text = std::str::from_utf8(pair).ok()?;
        out.push(u8::from_str_radix(text, 16).ok()?);
    }
    Some(out)
}
