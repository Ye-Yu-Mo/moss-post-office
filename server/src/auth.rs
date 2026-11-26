use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use rand::{thread_rng, Rng, RngCore};
use sha2::{Digest, Sha256};
use subtle::ConstantTimeEq;

const RECOVERY_ALPHABET: &[u8] = b"ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

pub fn new_player_id() -> String {
    let mut bytes = [0u8; 16];
    thread_rng().fill_bytes(&mut bytes);
    bytes.iter().map(|byte| format!("{byte:02x}")).collect()
}

pub fn new_token() -> String {
    let mut bytes = [0u8; 32];
    thread_rng().fill_bytes(&mut bytes);
    URL_SAFE_NO_PAD.encode(bytes)
}

/// 4 groups of 4 base32 characters: ~80 bits of entropy, easy to read out.
pub fn new_recovery_code() -> String {
    let mut rng = thread_rng();
    let mut groups = Vec::with_capacity(4);
    for _ in 0..4 {
        let group: String = (0..4)
            .map(|_| RECOVERY_ALPHABET[rng.gen_range(0..RECOVERY_ALPHABET.len())] as char)
            .collect();
        groups.push(group);
    }
    groups.join("-")
}

pub fn normalize_recovery(code: &str) -> String {
    code.chars()
        .filter(|ch| ch.is_ascii_alphanumeric())
        .map(|ch| ch.to_ascii_uppercase())
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
