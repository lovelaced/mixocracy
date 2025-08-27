#![no_main]
#![no_std]
extern crate alloc;
use alloc::{string::String, vec, vec::Vec};
use ethabi::{encode, decode, Token, ParamType};
use polkavm_derive::polkavm_export;
use simplealloc::SimpleAlloc;
use uapi::{HostFn, HostFnImpl as api, StorageFlags, ReturnFlags};

#[global_allocator]
static ALLOCATOR: SimpleAlloc<51200> = SimpleAlloc::new(); // 50KB allocator

// Storage key prefixes
const KEY_OWNER: [u8; 32] = [0u8; 32];
const PREFIX_DJ: u8 = 1;
const PREFIX_SONG: u8 = 2;
const PREFIX_VOTES: u8 = 3;
const PREFIX_HAS_VOTED: u8 = 4;
const PREFIX_SONG_COUNT: u8 = 5;
const PREFIX_SET_ACTIVE: u8 = 6;
const PREFIX_SET_START_TIME: u8 = 7;
const PREFIX_DJ_METADATA: u8 = 8;
const PREFIX_ACTIVE_DJS: u8 = 9;
const PREFIX_ACTIVE_DJ_COUNT: u8 = 10;
const PREFIX_ALL_DJS: u8 = 11;
const PREFIX_ALL_DJ_COUNT: u8 = 12;
const PREFIX_SONG_REMOVED: u8 = 13;

// Function selectors computed from ethers.js keccak256
const SELECTOR_REGISTER_DJ: [u8; 4] = [0x19, 0xc2, 0x36, 0xc0]; // registerDj(address)
const SELECTOR_ADD_SONG: [u8; 4] = [0x7f, 0x59, 0x0f, 0x5e]; // addSong(string)
const SELECTOR_VOTE: [u8; 4] = [0x5f, 0x74, 0xbb, 0xde]; // vote(address,uint256)
const SELECTOR_GET_VOTES: [u8; 4] = [0xeb, 0x90, 0x19, 0xd4]; // getVotes(address,uint256)
const SELECTOR_GET_SONG: [u8; 4] = [0xa4, 0xa2, 0x29, 0xcb]; // getSong(address,uint256)
const SELECTOR_GET_SONG_COUNT: [u8; 4] = [0xe8, 0x77, 0x1f, 0xbe]; // getSongCount(address)
const SELECTOR_IS_DJ: [u8; 4] = [0x41, 0xd1, 0x0b, 0xee]; // isDj(address)
const SELECTOR_REMOVE_DJ: [u8; 4] = [0x7b, 0x6b, 0x47, 0xa8]; // removeDj(address)
const SELECTOR_CLEAR_VOTES: [u8; 4] = [0xba, 0x37, 0x82, 0x9d]; // clearVotes(address,uint256)
const SELECTOR_HAS_VOTED: [u8; 4] = [0xa1, 0x87, 0x30, 0x2b]; // hasVoted(address,address,uint256)
const SELECTOR_START_SET: [u8; 4] = [0xb4, 0xd6, 0xb5, 0x62]; // startSet(address)
const SELECTOR_STOP_SET: [u8; 4] = [0x6b, 0x41, 0xc1, 0x69]; // stopSet(address)
const SELECTOR_IS_SET_ACTIVE: [u8; 4] = [0x2e, 0x81, 0x78, 0x2f]; // isSetActive(address)
const SELECTOR_GET_ACTIVE_DJS: [u8; 4] = [0x9a, 0x70, 0x9f, 0xa4]; // getActiveDjs()
const SELECTOR_GET_SONGS_WITH_VOTES: [u8; 4] = [0x0d, 0x35, 0x7d, 0x3d]; // getSongsWithVotes(address)
const SELECTOR_SET_DJ_METADATA: [u8; 4] = [0xb4, 0xa3, 0x14, 0x27]; // setDjMetadata(address,string)
const SELECTOR_GET_DJ_METADATA: [u8; 4] = [0x19, 0x7e, 0x05, 0x3e]; // getDjMetadata(address)
const SELECTOR_GET_DJ_INFO: [u8; 4] = [0xe9, 0x23, 0x0c, 0x05]; // getDjInfo(address)
const SELECTOR_GET_TOP_SONGS: [u8; 4] = [0xe7, 0xb9, 0x6e, 0x73]; // getTopSongs(address,uint256)
const SELECTOR_GET_ALL_DJS: [u8; 4] = [0xa2, 0xf8, 0x2c, 0x28]; // getAllDjs()
const SELECTOR_REMOVE_SONG: [u8; 4] = [0xd4, 0x34, 0x2c, 0xc7]; // removeSong(uint256)

// Helper functions for storage keys
fn get_dj_key(dj_address: &[u8; 20]) -> [u8; 32] {
    let mut key = [0u8; 32];
    key[0] = PREFIX_DJ;
    key[1..21].copy_from_slice(dj_address);
    key
}

fn get_song_count_key(dj_address: &[u8; 20]) -> [u8; 32] {
    let mut key = [0u8; 32];
    key[0] = PREFIX_SONG_COUNT;
    key[1..21].copy_from_slice(dj_address);
    key
}

fn get_song_key(dj_address: &[u8; 20], song_id: u32) -> [u8; 32] {
    let mut key = [0u8; 32];
    key[0] = PREFIX_SONG;
    key[1..21].copy_from_slice(dj_address);
    key[21..25].copy_from_slice(&song_id.to_le_bytes());
    key
}

fn get_song_removed_key(dj_address: &[u8; 20], song_id: u32) -> [u8; 32] {
    let mut key = [0u8; 32];
    key[0] = PREFIX_SONG_REMOVED;
    key[1..21].copy_from_slice(dj_address);
    key[21..25].copy_from_slice(&song_id.to_le_bytes());
    key
}

fn get_votes_key(dj_address: &[u8; 20], song_id: u32) -> [u8; 32] {
    let mut key = [0u8; 32];
    key[0] = PREFIX_VOTES;
    key[1..21].copy_from_slice(dj_address);
    key[21..25].copy_from_slice(&song_id.to_le_bytes());
    key
}

fn get_has_voted_key(voter: &[u8; 20], dj_address: &[u8; 20], song_id: u32) -> [u8; 32] {
    let mut key = [0u8; 32];
    key[0] = PREFIX_HAS_VOTED;
    let mut data = [0u8; 44];
    data[..20].copy_from_slice(voter);
    data[20..40].copy_from_slice(dj_address);
    data[40..44].copy_from_slice(&song_id.to_le_bytes());
    let mut hash = [0u8; 32];
    api::hash_keccak_256(&data, &mut hash);
    key[1..].copy_from_slice(&hash[..31]);
    key
}

fn get_set_active_key(dj_address: &[u8; 20]) -> [u8; 32] {
    let mut key = [0u8; 32];
    key[0] = PREFIX_SET_ACTIVE;
    key[1..21].copy_from_slice(dj_address);
    key
}

fn get_set_start_time_key(dj_address: &[u8; 20]) -> [u8; 32] {
    let mut key = [0u8; 32];
    key[0] = PREFIX_SET_START_TIME;
    key[1..21].copy_from_slice(dj_address);
    key
}

fn get_dj_metadata_key(dj_address: &[u8; 20]) -> [u8; 32] {
    let mut key = [0u8; 32];
    key[0] = PREFIX_DJ_METADATA;
    key[1..21].copy_from_slice(dj_address);
    key
}

fn get_active_dj_key(index: u32) -> [u8; 32] {
    let mut key = [0u8; 32];
    key[0] = PREFIX_ACTIVE_DJS;
    key[1..5].copy_from_slice(&index.to_le_bytes());
    key
}

fn get_active_dj_count_key() -> [u8; 32] {
    let mut key = [0u8; 32];
    key[0] = PREFIX_ACTIVE_DJ_COUNT;
    key
}

fn get_all_dj_key(index: u32) -> [u8; 32] {
    let mut key = [0u8; 32];
    key[0] = PREFIX_ALL_DJS;
    key[1..5].copy_from_slice(&index.to_le_bytes());
    key
}

fn get_all_dj_count_key() -> [u8; 32] {
    let mut key = [0u8; 32];
    key[0] = PREFIX_ALL_DJ_COUNT;
    key
}

// Storage helpers
fn save_address(key: &[u8; 32], address: &[u8; 20]) {
    api::set_storage(StorageFlags::empty(), key, address);
}

fn get_address(key: &[u8; 32]) -> Option<[u8; 20]> {
    let mut buffer = [0u8; 20];
    match api::get_storage(StorageFlags::empty(), key, &mut &mut buffer[..]) {
        Ok(_) => Some(buffer),
        Err(_) => None,
    }
}

fn save_bool(key: &[u8; 32], value: bool) {
    api::set_storage(StorageFlags::empty(), key, &[value as u8]);
}

fn get_bool(key: &[u8; 32]) -> bool {
    let mut buffer = [0u8; 1];
    match api::get_storage(StorageFlags::empty(), key, &mut &mut buffer[..]) {
        Ok(_) => buffer[0] != 0,
        Err(_) => false,
    }
}

fn save_u32(key: &[u8; 32], value: u32) {
    api::set_storage(StorageFlags::empty(), key, &value.to_le_bytes());
}

fn get_u32(key: &[u8; 32]) -> u32 {
    let mut buffer = [0u8; 4];
    match api::get_storage(StorageFlags::empty(), key, &mut &mut buffer[..]) {
        Ok(_) => u32::from_le_bytes(buffer),
        Err(_) => 0,
    }
}

fn save_string(key: &[u8; 32], value: &[u8]) {
    api::set_storage(StorageFlags::empty(), key, value);
}

fn get_string(key: &[u8; 32]) -> Option<Vec<u8>> {
    // Try with a reasonable buffer size
    let mut buffer = vec![0u8; 256];
    let mut buf_ref = &mut buffer[..];
    match api::get_storage(StorageFlags::empty(), key, &mut buf_ref) {
        Ok(_) => {
            // Find actual length by looking for trailing zeros
            let len = buffer.iter().rposition(|&b| b != 0).map(|i| i + 1).unwrap_or(0);
            if len == 0 {
                None
            } else {
                Some(buffer[..len].to_vec())
            }
        },
        Err(_) => None,
    }
}

fn is_owner(origin: &[u8; 20]) -> bool {
    match get_address(&KEY_OWNER) {
        Some(owner) => owner == *origin,
        None => false,
    }
}

fn get_origin() -> [u8; 20] {
    let mut origin = [0u8; 20];
    api::caller(&mut origin);
    origin
}

// Contract functions
fn register_dj(dj_address: [u8; 20]) {
    let origin = get_origin();
    
    assert!(is_owner(&origin), "NOT_OWNER");
    
    // Check if already registered
    let dj_key = get_dj_key(&dj_address);
    if !get_bool(&dj_key) {
        // Save DJ as registered
        save_bool(&dj_key, true);
        
        // Add to all DJs list
        let count_key = get_all_dj_count_key();
        let count = get_u32(&count_key);
        let dj_list_key = get_all_dj_key(count);
        save_address(&dj_list_key, &dj_address);
        save_u32(&count_key, count + 1);
    }
}

fn remove_dj(dj_address: [u8; 20]) {
    let origin = get_origin();
    
    assert!(is_owner(&origin), "NOT_OWNER");
    
    let dj_key = get_dj_key(&dj_address);
    save_bool(&dj_key, false);
}

fn is_dj(dj_address: [u8; 20]) -> bool {
    get_bool(&get_dj_key(&dj_address))
}

fn add_song(song_name: Vec<u8>) -> u32 {
    let origin = get_origin();
    
    assert!(get_bool(&get_dj_key(&origin)), "NOT_DJ");
    assert!(song_name.len() > 0, "EMPTY_SONG_NAME");
    assert!(song_name.len() <= 256, "SONG_NAME_TOO_LONG");
    
    let count_key = get_song_count_key(&origin);
    let song_id = get_u32(&count_key);
    
    let song_key = get_song_key(&origin, song_id);
    save_string(&song_key, &song_name);
    
    save_u32(&count_key, song_id + 1);
    
    song_id
}

fn remove_song(song_id: u32) {
    let origin = get_origin();
    
    assert!(get_bool(&get_dj_key(&origin)), "NOT_DJ");
    
    let song_key = get_song_key(&origin, song_id);
    assert!(get_string(&song_key).is_some(), "SONG_NOT_FOUND");
    
    // Mark song as removed
    let removed_key = get_song_removed_key(&origin, song_id);
    save_bool(&removed_key, true);
    
    // Clear votes for this song
    let votes_key = get_votes_key(&origin, song_id);
    save_u32(&votes_key, 0);
}

fn is_song_removed(dj_address: [u8; 20], song_id: u32) -> bool {
    let removed_key = get_song_removed_key(&dj_address, song_id);
    get_bool(&removed_key)
}

fn get_song(dj_address: [u8; 20], song_id: u32) -> Vec<u8> {
    let song_key = get_song_key(&dj_address, song_id);
    get_string(&song_key).unwrap_or_else(|| vec![])
}

fn get_song_count(dj_address: [u8; 20]) -> u32 {
    let count_key = get_song_count_key(&dj_address);
    get_u32(&count_key)
}

fn vote(dj_address: [u8; 20], song_id: u32) {
    let voter = get_origin();
    
    // Check if the DJ's set is currently active
    assert!(is_set_active(dj_address), "SET_NOT_ACTIVE");
    
    // Check if song exists
    let song_key = get_song_key(&dj_address, song_id);
    assert!(get_string(&song_key).is_some(), "SONG_NOT_FOUND");
    
    // Check if song is removed
    assert!(!is_song_removed(dj_address, song_id), "SONG_REMOVED");
    
    let has_voted_key = get_has_voted_key(&voter, &dj_address, song_id);
    assert!(!get_bool(&has_voted_key), "ALREADY_VOTED");
    
    save_bool(&has_voted_key, true);
    
    let votes_key = get_votes_key(&dj_address, song_id);
    let current_votes = get_u32(&votes_key);
    save_u32(&votes_key, current_votes + 1);
}

fn get_votes(dj_address: [u8; 20], song_id: u32) -> u32 {
    let votes_key = get_votes_key(&dj_address, song_id);
    get_u32(&votes_key)
}

fn has_voted(voter: [u8; 20], dj_address: [u8; 20], song_id: u32) -> bool {
    let has_voted_key = get_has_voted_key(&voter, &dj_address, song_id);
    get_bool(&has_voted_key)
}

fn clear_votes(dj_address: [u8; 20], song_id: u32) {
    let origin = get_origin();
    
    assert!(is_owner(&origin), "NOT_OWNER");
    
    let votes_key = get_votes_key(&dj_address, song_id);
    save_u32(&votes_key, 0);
}

// DJ Set Management Functions
fn start_set(dj_address: [u8; 20]) {
    let origin = get_origin();
    
    // Only the DJ themselves or the owner can start a set
    assert!(origin == dj_address || is_owner(&origin), "UNAUTHORIZED");
    assert!(is_dj(dj_address), "NOT_REGISTERED_DJ");
    assert!(!is_set_active(dj_address), "SET_ALREADY_ACTIVE");
    
    // Mark set as active
    save_bool(&get_set_active_key(&dj_address), true);
    save_u64(&get_set_start_time_key(&dj_address), get_block_timestamp());
    
    // Add to active DJs list
    let count_key = get_active_dj_count_key();
    let count = get_u32(&count_key);
    save_address(&get_active_dj_key(count), &dj_address);
    save_u32(&count_key, count + 1);
}

fn stop_set(dj_address: [u8; 20]) {
    let origin = get_origin();
    
    // Only the DJ themselves or the owner can stop a set
    assert!(origin == dj_address || is_owner(&origin), "UNAUTHORIZED");
    assert!(is_set_active(dj_address), "SET_NOT_ACTIVE");
    
    // Mark set as inactive
    save_bool(&get_set_active_key(&dj_address), false);
    
    // Remove from active DJs list
    remove_from_active_djs(&dj_address);
}

fn is_set_active(dj_address: [u8; 20]) -> bool {
    get_bool(&get_set_active_key(&dj_address))
}

fn remove_from_active_djs(dj_address: &[u8; 20]) {
    let count_key = get_active_dj_count_key();
    let count = get_u32(&count_key);
    
    // Find and remove the DJ
    let mut found_index = None;
    for i in 0..count {
        if let Some(addr) = get_address(&get_active_dj_key(i)) {
            if addr == *dj_address {
                found_index = Some(i);
                break;
            }
        }
    }
    
    if let Some(index) = found_index {
        // Move last DJ to this position
        if index < count - 1 {
            if let Some(last_dj) = get_address(&get_active_dj_key(count - 1)) {
                save_address(&get_active_dj_key(index), &last_dj);
            }
        }
        save_u32(&count_key, count - 1);
    }
}

fn get_active_djs() -> Vec<[u8; 20]> {
    let count_key = get_active_dj_count_key();
    let count = get_u32(&count_key);
    let mut djs = Vec::new();
    
    for i in 0..count {
        if let Some(dj) = get_address(&get_active_dj_key(i)) {
            djs.push(dj);
        }
    }
    
    djs
}

fn get_all_djs() -> Vec<[u8; 20]> {
    let count_key = get_all_dj_count_key();
    let count = get_u32(&count_key);
    let mut djs = Vec::new();
    
    for i in 0..count {
        if let Some(dj) = get_address(&get_all_dj_key(i)) {
            djs.push(dj);
        }
    }
    
    djs
}

// Enhanced getter functions
fn get_songs_with_votes(dj_address: [u8; 20]) -> Vec<(u32, Vec<u8>, u32)> {
    assert!(is_set_active(dj_address), "SET_NOT_ACTIVE");
    
    let song_count = get_song_count(dj_address);
    let mut songs = Vec::new();
    
    for i in 0..song_count {
        // Skip removed songs
        if is_song_removed(dj_address, i) {
            continue;
        }
        
        let song = get_song(dj_address, i);
        let votes = get_votes(dj_address, i);
        songs.push((i, song, votes));
    }
    
    songs
}

fn get_top_songs(dj_address: [u8; 20], limit: u32) -> Vec<(u32, Vec<u8>, u32)> {
    let mut songs = get_songs_with_votes(dj_address);
    
    // Sort by votes descending
    songs.sort_by(|a, b| b.2.cmp(&a.2));
    
    // Take only the top 'limit' songs
    songs.truncate(limit as usize);
    songs
}

// DJ Metadata functions
fn set_dj_metadata(dj_address: [u8; 20], metadata: Vec<u8>) {
    let origin = get_origin();
    
    // Only the DJ themselves or the owner can set metadata
    assert!(origin == dj_address || is_owner(&origin), "UNAUTHORIZED");
    assert!(is_dj(dj_address), "NOT_REGISTERED_DJ");
    assert!(metadata.len() <= 512, "METADATA_TOO_LONG");
    
    save_string(&get_dj_metadata_key(&dj_address), &metadata);
}

fn get_dj_metadata(dj_address: [u8; 20]) -> Vec<u8> {
    get_string(&get_dj_metadata_key(&dj_address)).unwrap_or_else(|| vec![])
}

// Combined DJ info for UI
fn get_dj_info(dj_address: [u8; 20]) -> (bool, bool, u64, u32, Vec<u8>) {
    let is_registered = is_dj(dj_address);
    let is_active = is_set_active(dj_address);
    let start_time = if is_active {
        get_u64(&get_set_start_time_key(&dj_address))
    } else {
        0
    };
    let song_count = get_song_count(dj_address);
    let metadata = get_dj_metadata(dj_address);
    
    (is_registered, is_active, start_time, song_count, metadata)
}

// Storage helpers for u64
fn save_u64(key: &[u8; 32], value: u64) {
    api::set_storage(StorageFlags::empty(), key, &value.to_le_bytes());
}

fn get_u64(key: &[u8; 32]) -> u64 {
    let mut buffer = [0u8; 8];
    match api::get_storage(StorageFlags::empty(), key, &mut &mut buffer[..]) {
        Ok(_) => u64::from_le_bytes(buffer),
        Err(_) => 0,
    }
}

fn get_block_timestamp() -> u64 {
    // In a real implementation, this would get the actual block timestamp
    // For now, return a placeholder
    0
}

fn dispatch(selector: [u8; 4], data: &[u8]) {
    match selector {
        SELECTOR_REGISTER_DJ => {
            let decoded = decode(&[ParamType::Address], data)
                .expect("Failed to decode params");
            let mut dj_address = [0u8; 20];
            if let Token::Address(addr) = &decoded[0] {
                dj_address.copy_from_slice(&addr.0);
            }
            register_dj(dj_address);
            api::return_value(ReturnFlags::empty(), &encode(&[Token::Bool(true)]));
        },
        SELECTOR_REMOVE_DJ => {
            let decoded = decode(&[ParamType::Address], data)
                .expect("Failed to decode params");
            let mut dj_address = [0u8; 20];
            if let Token::Address(addr) = &decoded[0] {
                dj_address.copy_from_slice(&addr.0);
            }
            remove_dj(dj_address);
            api::return_value(ReturnFlags::empty(), &encode(&[Token::Bool(true)]));
        },
        SELECTOR_IS_DJ => {
            let decoded = decode(&[ParamType::Address], data)
                .expect("Failed to decode params");
            let mut dj_address = [0u8; 20];
            if let Token::Address(addr) = &decoded[0] {
                dj_address.copy_from_slice(&addr.0);
            }
            let is_dj_result = is_dj(dj_address);
            api::return_value(ReturnFlags::empty(), &encode(&[Token::Bool(is_dj_result)]));
        },
        SELECTOR_ADD_SONG => {
            let decoded = decode(&[ParamType::String], data)
                .expect("Failed to decode params");
            let song_name = if let Token::String(s) = &decoded[0] {
                s.as_bytes().to_vec()
            } else {
                panic!("Invalid song name");
            };
            let song_id = add_song(song_name);
            api::return_value(ReturnFlags::empty(), &encode(&[Token::Uint(song_id.into())]));
        },
        SELECTOR_GET_SONG => {
            let decoded = decode(&[ParamType::Address, ParamType::Uint(256)], data)
                .expect("Failed to decode params");
            let mut dj_address = [0u8; 20];
            if let Token::Address(addr) = &decoded[0] {
                dj_address.copy_from_slice(&addr.0);
            }
            let song_id = if let Token::Uint(id) = &decoded[1] {
                id.as_u32()
            } else {
                panic!("Invalid song ID");
            };
            let song = get_song(dj_address, song_id);
            let song_string = String::from_utf8_lossy(&song).into_owned();
            api::return_value(ReturnFlags::empty(), &encode(&[Token::String(song_string)]));
        },
        SELECTOR_GET_SONG_COUNT => {
            let decoded = decode(&[ParamType::Address], data)
                .expect("Failed to decode params");
            let mut dj_address = [0u8; 20];
            if let Token::Address(addr) = &decoded[0] {
                dj_address.copy_from_slice(&addr.0);
            }
            let count = get_song_count(dj_address);
            api::return_value(ReturnFlags::empty(), &encode(&[Token::Uint(count.into())]));
        },
        SELECTOR_VOTE => {
            let decoded = decode(&[ParamType::Address, ParamType::Uint(256)], data)
                .expect("Failed to decode params");
            let mut dj_address = [0u8; 20];
            if let Token::Address(addr) = &decoded[0] {
                dj_address.copy_from_slice(&addr.0);
            }
            let song_id = if let Token::Uint(id) = &decoded[1] {
                id.as_u32()
            } else {
                panic!("Invalid song ID");
            };
            vote(dj_address, song_id);
            api::return_value(ReturnFlags::empty(), &encode(&[Token::Bool(true)]));
        },
        SELECTOR_GET_VOTES => {
            let decoded = decode(&[ParamType::Address, ParamType::Uint(256)], data)
                .expect("Failed to decode params");
            let mut dj_address = [0u8; 20];
            if let Token::Address(addr) = &decoded[0] {
                dj_address.copy_from_slice(&addr.0);
            }
            let song_id = if let Token::Uint(id) = &decoded[1] {
                id.as_u32()
            } else {
                panic!("Invalid song ID");
            };
            let votes = get_votes(dj_address, song_id);
            api::return_value(ReturnFlags::empty(), &encode(&[Token::Uint(votes.into())]));
        },
        SELECTOR_HAS_VOTED => {
            let decoded = decode(&[ParamType::Address, ParamType::Address, ParamType::Uint(256)], data)
                .expect("Failed to decode params");
            let mut voter = [0u8; 20];
            if let Token::Address(addr) = &decoded[0] {
                voter.copy_from_slice(&addr.0);
            }
            let mut dj_address = [0u8; 20];
            if let Token::Address(addr) = &decoded[1] {
                dj_address.copy_from_slice(&addr.0);
            }
            let song_id = if let Token::Uint(id) = &decoded[2] {
                id.as_u32()
            } else {
                panic!("Invalid song ID");
            };
            let voted = has_voted(voter, dj_address, song_id);
            api::return_value(ReturnFlags::empty(), &encode(&[Token::Bool(voted)]));
        },
        SELECTOR_CLEAR_VOTES => {
            let decoded = decode(&[ParamType::Address, ParamType::Uint(256)], data)
                .expect("Failed to decode params");
            let mut dj_address = [0u8; 20];
            if let Token::Address(addr) = &decoded[0] {
                dj_address.copy_from_slice(&addr.0);
            }
            let song_id = if let Token::Uint(id) = &decoded[1] {
                id.as_u32()
            } else {
                panic!("Invalid song ID");
            };
            clear_votes(dj_address, song_id);
            api::return_value(ReturnFlags::empty(), &encode(&[Token::Bool(true)]));
        },
        SELECTOR_START_SET => {
            let decoded = decode(&[ParamType::Address], data)
                .expect("Failed to decode params");
            let mut dj_address = [0u8; 20];
            if let Token::Address(addr) = &decoded[0] {
                dj_address.copy_from_slice(&addr.0);
            }
            start_set(dj_address);
            api::return_value(ReturnFlags::empty(), &encode(&[Token::Bool(true)]));
        },
        SELECTOR_STOP_SET => {
            let decoded = decode(&[ParamType::Address], data)
                .expect("Failed to decode params");
            let mut dj_address = [0u8; 20];
            if let Token::Address(addr) = &decoded[0] {
                dj_address.copy_from_slice(&addr.0);
            }
            stop_set(dj_address);
            api::return_value(ReturnFlags::empty(), &encode(&[Token::Bool(true)]));
        },
        SELECTOR_IS_SET_ACTIVE => {
            let decoded = decode(&[ParamType::Address], data)
                .expect("Failed to decode params");
            let mut dj_address = [0u8; 20];
            if let Token::Address(addr) = &decoded[0] {
                dj_address.copy_from_slice(&addr.0);
            }
            let is_active = is_set_active(dj_address);
            api::return_value(ReturnFlags::empty(), &encode(&[Token::Bool(is_active)]));
        },
        SELECTOR_GET_ACTIVE_DJS => {
            let djs = get_active_djs();
            let addresses: Vec<Token> = djs.iter()
                .map(|addr| Token::Address((*addr).into()))
                .collect();
            api::return_value(ReturnFlags::empty(), &encode(&[Token::Array(addresses)]));
        },
        SELECTOR_GET_ALL_DJS => {
            let djs = get_all_djs();
            let addresses: Vec<Token> = djs.iter()
                .map(|addr| Token::Address((*addr).into()))
                .collect();
            api::return_value(ReturnFlags::empty(), &encode(&[Token::Array(addresses)]));
        },
        SELECTOR_GET_SONGS_WITH_VOTES => {
            let decoded = decode(&[ParamType::Address], data)
                .expect("Failed to decode params");
            let mut dj_address = [0u8; 20];
            if let Token::Address(addr) = &decoded[0] {
                dj_address.copy_from_slice(&addr.0);
            }
            let songs = get_songs_with_votes(dj_address);
            let result: Vec<Token> = songs.iter()
                .map(|(id, name, votes)| Token::Tuple(vec![
                    Token::Uint((*id).into()),
                    Token::String(String::from_utf8_lossy(name).into_owned()),
                    Token::Uint((*votes).into())
                ]))
                .collect();
            api::return_value(ReturnFlags::empty(), &encode(&[Token::Array(result)]));
        },
        SELECTOR_GET_TOP_SONGS => {
            let decoded = decode(&[ParamType::Address, ParamType::Uint(256)], data)
                .expect("Failed to decode params");
            let mut dj_address = [0u8; 20];
            if let Token::Address(addr) = &decoded[0] {
                dj_address.copy_from_slice(&addr.0);
            }
            let limit = if let Token::Uint(l) = &decoded[1] {
                l.as_u32()
            } else {
                10 // default limit
            };
            let songs = get_top_songs(dj_address, limit);
            let result: Vec<Token> = songs.iter()
                .map(|(id, name, votes)| Token::Tuple(vec![
                    Token::Uint((*id).into()),
                    Token::String(String::from_utf8_lossy(name).into_owned()),
                    Token::Uint((*votes).into())
                ]))
                .collect();
            api::return_value(ReturnFlags::empty(), &encode(&[Token::Array(result)]));
        },
        SELECTOR_SET_DJ_METADATA => {
            let decoded = decode(&[ParamType::Address, ParamType::String], data)
                .expect("Failed to decode params");
            let mut dj_address = [0u8; 20];
            if let Token::Address(addr) = &decoded[0] {
                dj_address.copy_from_slice(&addr.0);
            }
            let metadata = if let Token::String(s) = &decoded[1] {
                s.as_bytes().to_vec()
            } else {
                panic!("Invalid metadata");
            };
            set_dj_metadata(dj_address, metadata);
            api::return_value(ReturnFlags::empty(), &encode(&[Token::Bool(true)]));
        },
        SELECTOR_GET_DJ_METADATA => {
            let decoded = decode(&[ParamType::Address], data)
                .expect("Failed to decode params");
            let mut dj_address = [0u8; 20];
            if let Token::Address(addr) = &decoded[0] {
                dj_address.copy_from_slice(&addr.0);
            }
            let metadata = get_dj_metadata(dj_address);
            let metadata_string = String::from_utf8_lossy(&metadata).into_owned();
            api::return_value(ReturnFlags::empty(), &encode(&[Token::String(metadata_string)]));
        },
        SELECTOR_GET_DJ_INFO => {
            let decoded = decode(&[ParamType::Address], data)
                .expect("Failed to decode params");
            let mut dj_address = [0u8; 20];
            if let Token::Address(addr) = &decoded[0] {
                dj_address.copy_from_slice(&addr.0);
            }
            let (is_registered, is_active, start_time, song_count, metadata) = get_dj_info(dj_address);
            api::return_value(ReturnFlags::empty(), &encode(&[Token::Tuple(vec![
                Token::Bool(is_registered),
                Token::Bool(is_active),
                Token::Uint(start_time.into()),
                Token::Uint(song_count.into()),
                Token::String(String::from_utf8_lossy(&metadata).into_owned())
            ])]));
        },
        SELECTOR_REMOVE_SONG => {
            let decoded = decode(&[ParamType::Uint(256)], data)
                .expect("Failed to decode params");
            let song_id = if let Token::Uint(id) = &decoded[0] {
                id.as_u32()
            } else {
                panic!("Invalid song ID");
            };
            remove_song(song_id);
            api::return_value(ReturnFlags::empty(), &encode(&[Token::Bool(true)]));
        },
        _ => {
            // Unknown selector - handle as fallback
            api::return_value(ReturnFlags::empty(), &[]);
        }
    }
}

#[no_mangle]
#[polkavm_export]
pub extern "C" fn deploy() {
    let origin = get_origin();
    save_address(&KEY_OWNER, &origin);
}

#[no_mangle]
#[polkavm_export]
pub extern "C" fn call() {
    let length = api::call_data_size() as usize;
    if length == 0 {
        api::return_value(ReturnFlags::empty(), &[]);
    }
    if length < 4 {
        api::return_value(ReturnFlags::REVERT, b"Invalid input");
    }
    
    let mut selector = [0u8; 4];
    api::call_data_copy(&mut selector, 0);
    
    let data_len = length.saturating_sub(4).min(10240);
    let mut data = vec![0u8; data_len];
    if data_len > 0 {
        api::call_data_copy(&mut data, 4);
    }
    
    dispatch(selector, &data);
}

#[panic_handler]
fn panic(_info: &core::panic::PanicInfo) -> ! {
    unsafe {
        core::arch::asm!("unimp");
        core::hint::unreachable_unchecked();
    }
}