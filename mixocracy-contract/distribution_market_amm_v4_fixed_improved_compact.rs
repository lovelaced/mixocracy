#![no_main]
#![no_std]
extern crate alloc;
use alloc::vec::Vec;
use ethabi::{encode, decode, Token, ParamType};
use polkavm_derive::polkavm_export;
use simplealloc::SimpleAlloc;
use uapi::{HostFn, HostFnImpl as api, StorageFlags, ReturnFlags, CallFlags};
#[global_allocator]
static ALLOCATOR: SimpleAlloc<100000> = SimpleAlloc::new(); 
const DECIMALS: u64 = 1_000_000_000;
const MAX_INPUT: usize = 1000;
const MAX_STORAGE_VALUE: usize = 512;
const WEI_TO_FIXED: u64 = 1_000_000_000; 
const MIN_TRANSFER_UNIT: u64 = 1_000_000; 
const PI_FIXED: u64 = 3_141_592_654; 
const SQRT_PI_FIXED: u64 = 1_772_453_851; 
const SQRT_2PI_FIXED: u64 = 2_506_628_275; 
const E_FIXED: u64 = 2_718_281_828; 
const TAYLOR_ITERATIONS: u32 = 15; 
const MIN_VARIANCE: u64 = 1_000_000; 
const INTEGRATION_STEPS: u64 = 20; 
const OWNER_KEY: &[u8] = b"owner";
const INITIALIZED_KEY: &[u8] = b"initialized";
const MARKET_COUNT_KEY: &[u8] = b"market_count";
const POSITION_COUNT_KEY: &[u8] = b"position_count";
const LP_TOKEN_PREFIX: &[u8] = b"lp_";
const METADATA_PREFIX: &[u8] = b"meta_";
const POSITION_BY_ID_PREFIX: &[u8] = b"pos_id_";
const TRADER_POSITIONS_PREFIX: &[u8] = b"trader_pos_";
const TRADER_POS_COUNT_PREFIX: &[u8] = b"trader_cnt_";
const BLOCK_NUMBER_KEY: &[u8] = b"block_number";
const INITIALIZE_SELECTOR: [u8; 4] = [0x81, 0x29, 0xfc, 0x1c];
const CREATE_MARKET_SELECTOR: [u8; 4] = [0x44, 0xb8, 0x5a, 0x62];
const TRADE_DISTRIBUTION_SELECTOR: [u8; 4] = [0x5e, 0xa5, 0xec, 0xce];
const ADD_LIQUIDITY_SELECTOR: [u8; 4] = [0x72, 0x26, 0x13, 0x33]; 
const REMOVE_LIQUIDITY_SELECTOR: [u8; 4] = [0x88, 0xb2, 0x26, 0x37];
const GET_MARKET_STATE_SELECTOR: [u8; 4] = [0x20, 0x1d, 0x2f, 0x2b];
const GET_CONSENSUS_SELECTOR: [u8; 4] = [0xb9, 0xf2, 0xf5, 0xbb]; 
const GET_METADATA_SELECTOR: [u8; 4] = [0x99, 0x8e, 0x84, 0xa3];
const GET_MARKET_COUNT_SELECTOR: [u8; 4] = [0xfd, 0x69, 0xf3, 0xc2];
const CLOSE_POSITION_SELECTOR: [u8; 4] = [0x38, 0x4c, 0x07, 0xe6];
const GET_POSITION_SELECTOR: [u8; 4] = [0x0f, 0x85, 0xfc, 0x5a];
const GET_TRADER_POSITIONS_SELECTOR: [u8; 4] = [0x5f, 0xbb, 0xb2, 0xff];
const RESOLVE_MARKET_SELECTOR: [u8; 4] = [0x6d, 0x22, 0x83, 0xa4];
const CLAIM_WINNINGS_SELECTOR: [u8; 4] = [0x08, 0xf7, 0xed, 0x50];
const CALCULATE_TRADE_SELECTOR: [u8; 4] = [0x6c, 0xfa, 0x49, 0x1b]; 
const GET_LP_BALANCE_SELECTOR: [u8; 4] = [0x0e, 0x3e, 0x56, 0xf8];
const GET_AMM_HOLDINGS_SELECTOR: [u8; 4] = [0x82, 0x51, 0xa2, 0x82]; 
const EVALUATE_AT_SELECTOR: [u8; 4] = [0x3b, 0x51, 0x07, 0x6f];
const GET_CDF_SELECTOR: [u8; 4] = [0xd8, 0xff, 0xb3, 0x5a];
const GET_EXPECTED_VALUE_SELECTOR: [u8; 4] = [0x92, 0xac, 0xfd, 0xf9];
const GET_BOUNDS_SELECTOR: [u8; 4] = [0x35, 0x24, 0xad, 0x0d];
const GET_MARKET_INFO_SELECTOR: [u8; 4] = [0x3c, 0xc4, 0xfc, 0x4a];
const GET_POSITION_VALUE_SELECTOR: [u8; 4] = [0xe6, 0x95, 0x16, 0x61];
const GET_TVL_SELECTOR: [u8; 4] = [0xee, 0x4c, 0xc8, 0x4c]; 
const MARKET_STATUS_OPEN: u8 = 0;
const MARKET_STATUS_CLOSED: u8 = 1;
const MARKET_STATUS_RESOLVED: u8 = 2;
#[derive(Clone)]
struct Market {
 creator: [u8; 20],
 creation_time: u64,
 close_time: u64,
 k_norm: u64, 
 b_backing: u64, 
 current_mean: u64, 
 current_variance: u64, 
 total_lp_shares: u64, 
 total_backing: u64, 
 accumulated_fees: u64, 
 next_position_id: u64, 
 total_volume: u64, 
 status: u8, 
 resolution_mean: u64, 
 resolution_variance: u64, 
}
#[derive(Clone)]
struct Position {
 position_id: u64,
 trader: [u8; 20],
 market_id: u64,
 from_mean: u64,
 from_variance: u64,
 to_mean: u64,
 to_variance: u64,
 size: u64,
 collateral_locked: u64,
 cost_basis: u64,
 is_open: u8,
 opened_at: u64,
 closed_at: u64,
 exit_value: u64,
 fees_paid: u64,
 realized_pnl: i64,
 claimed: u8,
}
fn encode_revert(message: &str) -> Vec<u8> {
 let mut result = Vec::with_capacity(68 + message.len());
 result.extend_from_slice(&[0x08, 0xc3, 0x79, 0xa0]);
 let error_data = encode(&[
 Token::String(message.into()),
 ]);
 result.extend_from_slice(&error_data);
 result
}
fn wei_to_fixed(wei: u64) -> Result<u64, &'static str> {
 wei.checked_div(WEI_TO_FIXED).ok_or("Wei conversion overflow")
}
fn fixed_to_wei(fixed: u64) -> Result<u64, &'static str> {
 fixed.checked_mul(WEI_TO_FIXED).ok_or("Fixed to wei overflow")
}
fn round_wei_for_transfer(wei: u64) -> u64 {
 (wei / MIN_TRANSFER_UNIT) * MIN_TRANSFER_UNIT
}
fn get_block_number() -> u64 {
 let mut block_bytes = [0u8; 8];
 let _ = api::get_storage(
 StorageFlags::empty(),
 BLOCK_NUMBER_KEY,
 &mut &mut block_bytes[..],
 );
 u64::from_le_bytes(block_bytes)
}
fn get_timestamp() -> u64 {
 let mut timestamp_bytes = [0u8; 32];
 api::now(&mut timestamp_bytes);
 let mut timestamp_u64_bytes = [0u8; 8];
 timestamp_u64_bytes.copy_from_slice(&timestamp_bytes[0..8]);
 u64::from_le_bytes(timestamp_u64_bytes)
}
fn u256_bytes(value: u64) -> [u8; 32] {
 let mut result = [0u8; 32];
 result[0..8].copy_from_slice(&value.to_le_bytes());
 result
}
fn get_market_key(market_id: u64) -> [u8; 16] {
 let mut key = [0u8; 16];
 key[0..7].copy_from_slice(b"market_");
 key[8..16].copy_from_slice(&market_id.to_le_bytes());
 key
}
fn get_lp_balance_key(market_id: u64, address: &[u8; 20]) -> [u8; 32] {
 let mut key = [0u8; 32];
 key[0..3].copy_from_slice(LP_TOKEN_PREFIX);
 key[3..11].copy_from_slice(&market_id.to_le_bytes());
 key[11..31].copy_from_slice(address);
 key
}
fn get_metadata_key(market_id: u64) -> [u8; 13] {
 let mut key = [0u8; 13];
 key[0..5].copy_from_slice(METADATA_PREFIX);
 key[5..13].copy_from_slice(&market_id.to_le_bytes());
 key
}
fn get_position_key(position_id: u64) -> [u8; 15] {
 let mut key = [0u8; 15];
 key[0..7].copy_from_slice(POSITION_BY_ID_PREFIX);
 key[7..15].copy_from_slice(&position_id.to_le_bytes());
 key
}
fn get_trader_positions_key(trader: &[u8; 20], index: u64) -> [u8; 39] {
 let mut key = [0u8; 39];
 key[0..11].copy_from_slice(TRADER_POSITIONS_PREFIX);
 key[11..31].copy_from_slice(trader);
 key[31..39].copy_from_slice(&index.to_le_bytes());
 key
}
fn get_trader_position_count_key(trader: &[u8; 20]) -> [u8; 31] {
 let mut key = [0u8; 31];
 key[0..11].copy_from_slice(TRADER_POS_COUNT_PREFIX);
 key[11..31].copy_from_slice(trader);
 key
}
fn mul_fixed(a: u64, b: u64) -> Result<u64, &'static str> {
 let result = (a as u128).saturating_mul(b as u128) / DECIMALS as u128;
 if result > u64::MAX as u128 {
 return Err("Multiplication overflow");
 }
 Ok(result as u64)
}
fn div_fixed(a: u64, b: u64) -> Result<u64, &'static str> {
 if b == 0 {
 return Err("Division by zero");
 }
 let result = (a as u128).saturating_mul(DECIMALS as u128) / b as u128;
 if result > u64::MAX as u128 {
 return Err("Division overflow");
 }
 Ok(result as u64)
}
fn sqrt_fixed(x: u64) -> u64 {
 if x == 0 {
 return 0;
 }
 let raw_sqrt = integer_sqrt(x);
 let result = raw_sqrt as u128 * 31623u128;
 if result > u64::MAX as u128 {
 u64::MAX
 } else {
 result as u64
 }
}
fn integer_sqrt(x: u64) -> u64 {
 if x == 0 {
 return 0;
 }
 let mut result = x;
 let mut last_result = 0;
 while result != last_result {
 last_result = result;
 result = (result + x / result) / 2;
 }
 result
}
fn exp_neg_fixed(x: u64) -> u64 {
 if x == 0 {
 return DECIMALS;
 }
 if x > 20 * DECIMALS {
 return 0;
 }
 let exp_x = exp_fixed(x);
 if exp_x == 0 {
 return 0;
 }
 div_fixed(DECIMALS, exp_x).unwrap_or(0)
}
fn exp_fixed(x: u64) -> u64 {
 if x == 0 {
 return DECIMALS;
 }
 if x > 20 * DECIMALS {
 return u64::MAX;
 }
 let mut result = DECIMALS;
 let mut term = DECIMALS;
 for i in 1..TAYLOR_ITERATIONS {
 match mul_fixed(term, x) {
 Ok(new_term) => {
 term = new_term / (i as u64);
 }
 Err(_) => {
 break;
 }
 }
 result = result.saturating_add(term);
 if term < 100 {
 break;
 }
 }
 result
}
fn normal_pdf(x: u64, mean: u64, variance: u64) -> u64 {
 if variance < MIN_VARIANCE {
 return 0;
 }
 let sigma = sqrt_fixed(variance);
 if sigma == 0 {
 return 0;
 }
 let diff = if x > mean { x - mean } else { mean - x };
 let four_sigma = sigma.saturating_mul(4);
 if diff > four_sigma {
 return 0;
 }
 let diff_squared = mul_fixed(diff, diff).unwrap_or(u64::MAX);
 let two_variance = variance.saturating_mul(2);
 let exponent = div_fixed(diff_squared, two_variance).unwrap_or(u64::MAX);
 if exponent > 10 * DECIMALS {
 return 0;
 }
 let exp_value = exp_neg_fixed(exponent);
 let sigma_sqrt_2pi = mul_fixed(sigma, SQRT_2PI_FIXED).unwrap_or(u64::MAX);
 let normalization = div_fixed(DECIMALS, sigma_sqrt_2pi).unwrap_or(0);
 mul_fixed(normalization, exp_value).unwrap_or(0)
}
fn erf_fixed(x: u64) -> u64 {
 let p = 327_591_100; 
 let a1 = 254_829_592; 
 let a2 = 284_496_736; 
 let a3 = 1_421_413_741; 
 let a4 = 1_453_152_027; 
 let a5 = 1_061_405_429; 
 let px = mul_fixed(p, x).unwrap_or(u64::MAX);
 let t = div_fixed(DECIMALS, DECIMALS + px).unwrap_or(0);
 let t2 = mul_fixed(t, t).unwrap_or(0);
 let t3 = mul_fixed(t2, t).unwrap_or(0);
 let t4 = mul_fixed(t3, t).unwrap_or(0);
 let t5 = mul_fixed(t4, t).unwrap_or(0);
 let poly = mul_fixed(a1, t).unwrap_or(0)
 .saturating_sub(mul_fixed(a2, t2).unwrap_or(0))
 .saturating_add(mul_fixed(a3, t3).unwrap_or(0))
 .saturating_sub(mul_fixed(a4, t4).unwrap_or(0))
 .saturating_add(mul_fixed(a5, t5).unwrap_or(0));
 let x_squared = mul_fixed(x, x).unwrap_or(u64::MAX);
 let exp_neg_x2 = exp_neg_fixed(x_squared);
 let result = mul_fixed(poly, exp_neg_x2).unwrap_or(0);
 DECIMALS.saturating_sub(result)
}
fn normal_cdf(x: u64, mean: u64, variance: u64) -> u64 {
 if variance < MIN_VARIANCE {
 return if x >= mean { DECIMALS } else { 0 };
 }
 let sigma = sqrt_fixed(variance);
 const SQRT_2_FIXED: u64 = 1_414_213_562;
 let sqrt_2_sigma = mul_fixed(SQRT_2_FIXED, sigma).unwrap_or(u64::MAX);
 let z = if x >= mean {
 div_fixed(x - mean, sqrt_2_sigma).unwrap_or(u64::MAX)
 } else {
 let z_pos = div_fixed(mean - x, sqrt_2_sigma).unwrap_or(u64::MAX);
 let erf_z = erf_fixed(z_pos);
 return div_fixed(DECIMALS - erf_z, 2 * DECIMALS).unwrap_or(DECIMALS / 2);
 };
 let erf_z = erf_fixed(z);
 div_fixed(DECIMALS + erf_z, 2 * DECIMALS).unwrap_or(DECIMALS / 2)
}
fn calculate_l2_norm_normal(variance: u64) -> Result<u64, &'static str> {
 if variance < MIN_VARIANCE {
 return Err("Variance too small");
 }
 let sigma = sqrt_fixed(variance);
 let two_sigma = mul_fixed(2 * DECIMALS, sigma)?;
 let two_sigma_sqrt_pi = mul_fixed(two_sigma, SQRT_PI_FIXED)?;
 div_fixed(DECIMALS, two_sigma_sqrt_pi)
}
fn calculate_lambda(k_norm: u64, variance: u64) -> Result<u64, &'static str> {
 if variance < MIN_VARIANCE {
 return Err("Variance too small");
 }
 let sigma = sqrt_fixed(variance);
 let sigma_sqrt_2pi = mul_fixed(sigma, SQRT_2PI_FIXED)?;
 mul_fixed(k_norm, sigma_sqrt_2pi)
}
fn calculate_f_max(k_norm: u64, variance: u64) -> Result<u64, &'static str> {
 Ok(k_norm)
}
fn calculate_min_variance(k_norm: u64, b_backing: u64) -> Result<u64, &'static str> {
 if b_backing == 0 {
 return Err("Backing is zero");
 }
 Ok(MIN_VARIANCE)
}
fn calculate_expected_value(mean: u64, _variance: u64) -> u64 {
 mean
}
fn get_distribution_bounds(mean: u64, variance: u64) -> (u64, u64) {
 let sigma = sqrt_fixed(variance);
 let three_sigma = sigma.saturating_mul(3);
 let lower = mean.saturating_sub(three_sigma);
 let upper = mean.saturating_add(three_sigma);
 (lower, upper)
}
fn calculate_amm_holdings(x: u64, market: &Market) -> u64 {
 let lambda = calculate_lambda(market.k_norm, market.current_variance).unwrap_or(0);
 let pdf_value = normal_pdf(x, market.current_mean, market.current_variance);
 let f_value = mul_fixed(lambda, pdf_value).unwrap_or(0);
 let capped_f_value = if f_value > market.b_backing {
 market.b_backing
 } else {
 f_value
 };
 market.b_backing.saturating_sub(capped_f_value)
}
fn calculate_l2_norm_difference(
 mean1: u64, variance1: u64, lambda1: u64,
 mean2: u64, variance2: u64, lambda2: u64
) -> Result<u64, &'static str> {
 let sigma1 = sqrt_fixed(variance1);
 let sigma2 = sqrt_fixed(variance2);
 let lambda1_squared = mul_fixed(lambda1, lambda1)?;
 let two_sigma1_sqrt_pi = mul_fixed(mul_fixed(2 * DECIMALS, sigma1)?, SQRT_PI_FIXED)?;
 let term1 = div_fixed(lambda1_squared, two_sigma1_sqrt_pi)?;
 let lambda2_squared = mul_fixed(lambda2, lambda2)?;
 let two_sigma2_sqrt_pi = mul_fixed(mul_fixed(2 * DECIMALS, sigma2)?, SQRT_PI_FIXED)?;
 let term2 = div_fixed(lambda2_squared, two_sigma2_sqrt_pi)?;
 let variance_sum = variance1 + variance2;
 let mean_diff = if mean1 > mean2 { mean1 - mean2 } else { mean2 - mean1 };
 let mean_diff_squared = mul_fixed(mean_diff, mean_diff)?;
 let two_variance_sum = variance_sum.saturating_mul(2);
 let exponent = div_fixed(mean_diff_squared, two_variance_sum)?;
 let exp_term = exp_neg_fixed(exponent);
 let lambda_product = mul_fixed(lambda1, lambda2)?;
 let two_lambda_product = lambda_product.saturating_mul(2);
 let sqrt_2pi_variance_sum = sqrt_fixed(mul_fixed(mul_fixed(2 * DECIMALS, PI_FIXED)?, variance_sum)?);
 let coefficient = div_fixed(two_lambda_product, sqrt_2pi_variance_sum)?;
 let term3 = mul_fixed(coefficient, exp_term)?;
 let sum = term1.saturating_add(term2);
 let l2_norm_squared = sum.saturating_sub(term3);
 Ok(sqrt_fixed(l2_norm_squared))
}
fn calculate_trade_cost(
 k_norm: u64,
 from_mean: u64, from_variance: u64,
 to_mean: u64, to_variance: u64,
 size: u64
) -> Result<(u64, u64, u64), &'static str> {
 let lambda_from = calculate_lambda(k_norm, from_variance)?;
 let lambda_to = calculate_lambda(k_norm, to_variance)?;
 let l2_diff = calculate_l2_norm_difference(
 from_mean, from_variance, lambda_from,
 to_mean, to_variance, lambda_to
 )?;
 let base_cost = mul_fixed(l2_diff, size)?;
 let fee = (base_cost * 3) / 1000;
 let collateral_required = calculate_collateral_requirement(
 k_norm, from_mean, from_variance, to_mean, to_variance, size
 )?;
 Ok((base_cost + fee, fee, collateral_required))
}
fn calculate_collateral_requirement(
 k_norm: u64,
 from_mean: u64, from_variance: u64,
 to_mean: u64, to_variance: u64,
 size: u64
) -> Result<u64, &'static str> {
 let lambda_from = calculate_lambda(k_norm, from_variance)?;
 let lambda_to = calculate_lambda(k_norm, to_variance)?;
 if from_variance == to_variance {
 let x_min = (from_mean + to_mean) / 2;
 let g_value = mul_fixed(lambda_from, normal_pdf(x_min, from_mean, from_variance))?;
 let f_value = mul_fixed(lambda_to, normal_pdf(x_min, to_mean, to_variance))?;
 if g_value > f_value {
 return Ok(0);
 } else {
 let diff = f_value - g_value;
 return mul_fixed(diff, size);
 }
 }
 let sigma_from = sqrt_fixed(from_variance);
 let sigma_to = sqrt_fixed(to_variance);
 let points = [
 from_mean,
 to_mean,
 (from_mean + to_mean) / 2,
 from_mean.saturating_sub(sigma_from),
 from_mean.saturating_add(sigma_from),
 to_mean.saturating_sub(sigma_to),
 to_mean.saturating_add(sigma_to),
 ];
 let mut max_deficit = 0u64;
 for &x in &points {
 let g_value = mul_fixed(lambda_from, normal_pdf(x, from_mean, from_variance))?;
 let f_value = mul_fixed(lambda_to, normal_pdf(x, to_mean, to_variance))?;
 if f_value > g_value {
 let deficit = f_value - g_value;
 if deficit > max_deficit {
 max_deficit = deficit;
 }
 }
 }
 mul_fixed(max_deficit, size)
}
fn calculate_position_value(
 position: &Position,
 current_mean: u64,
 current_variance: u64,
 k_norm: u64
) -> Result<u64, &'static str> {
 let current_lambda = calculate_lambda(k_norm, current_variance)?;
 let from_lambda = calculate_lambda(k_norm, position.from_variance)?;
 let to_lambda = calculate_lambda(k_norm, position.to_variance)?;
 let current_std = sqrt_fixed(current_variance);
 let from_std = sqrt_fixed(position.from_variance);
 let to_std = sqrt_fixed(position.to_variance);
 let max_std = if current_std > from_std {
 if current_std > to_std { current_std } else { to_std }
 } else {
 if from_std > to_std { from_std } else { to_std }
 };
 let three_sigma = mul_fixed(max_std, 3 * DECIMALS)?;
 let center = if position.from_mean > current_mean {
 if position.from_mean > position.to_mean {
 position.from_mean
 } else if position.to_mean > current_mean {
 position.to_mean
 } else {
 current_mean
 }
 } else if current_mean > position.to_mean {
 current_mean
 } else {
 position.to_mean
 };
 let lower_bound = center.saturating_sub(three_sigma);
 let upper_bound = center.saturating_add(three_sigma);
 let num_steps = INTEGRATION_STEPS;
 let range = upper_bound.saturating_sub(lower_bound);
 if range == 0 {
 return Ok(position.cost_basis);
 }
 let dx = if range < num_steps {
 1
 } else {
 range / num_steps
 };
 let mut integral_sum = 0i128; 
 for i in 0..=num_steps {
 let step_offset = if i == 0 {
 0
 } else if i == num_steps {
 range
 } else {
 ((range as u128 * i as u128) / num_steps as u128) as u64
 };
 let x = lower_bound.saturating_add(step_offset);
 let pdf_from = normal_pdf(x, position.from_mean, position.from_variance);
 let f_from = mul_fixed(from_lambda, pdf_from)?;
 let pdf_to = normal_pdf(x, position.to_mean, position.to_variance);
 let f_to = mul_fixed(to_lambda, pdf_to)?;
 let pdf_current = normal_pdf(x, current_mean, current_variance);
 let f_current = mul_fixed(current_lambda, pdf_current)?;
 let position_value = f_to as i128 - f_from as i128;
 let product = (position_value * f_current as i128) / DECIMALS as i128;
 if i == 0 || i == num_steps {
 integral_sum += product / 2;
 } else {
 integral_sum += product;
 }
 }
 let integral_result = if range < num_steps {
 integral_sum / DECIMALS as i128
 } else {
 (integral_sum * dx as i128) / DECIMALS as i128
 };
 let expected_payout = if integral_result >= 0 {
 let payout_per_unit = integral_result as u64;
 mul_fixed(payout_per_unit, position.size)?
 } else {
 0 
 };
 Ok(expected_payout)
}
fn load_market(market_id: u64) -> Option<Market> {
 let key = get_market_key(market_id);
 let mut buffer = [0u8; MAX_STORAGE_VALUE];
 let _ = api::get_storage(
 StorageFlags::empty(),
 &key,
 &mut &mut buffer[..],
 );
 if buffer[0] != 0 || buffer[1] != 0 {
 let mut market = Market {
 creator: [0u8; 20],
 creation_time: 0,
 close_time: 0,
 k_norm: 0,
 b_backing: 0,
 current_mean: 0,
 current_variance: 0,
 total_lp_shares: 0,
 total_backing: 0,
 accumulated_fees: 0,
 next_position_id: 0,
 total_volume: 0,
 status: 0,
 resolution_mean: 0,
 resolution_variance: 0,
 };
 let mut offset = 0;
 market.creator.copy_from_slice(&buffer[offset..offset+20]);
 offset += 20;
 market.creation_time = u64::from_le_bytes(buffer[offset..offset+8].try_into().unwrap());
 offset += 8;
 market.close_time = u64::from_le_bytes(buffer[offset..offset+8].try_into().unwrap());
 offset += 8;
 market.k_norm = u64::from_le_bytes(buffer[offset..offset+8].try_into().unwrap());
 offset += 8;
 market.b_backing = u64::from_le_bytes(buffer[offset..offset+8].try_into().unwrap());
 offset += 8;
 market.current_mean = u64::from_le_bytes(buffer[offset..offset+8].try_into().unwrap());
 offset += 8;
 market.current_variance = u64::from_le_bytes(buffer[offset..offset+8].try_into().unwrap());
 offset += 8;
 market.total_lp_shares = u64::from_le_bytes(buffer[offset..offset+8].try_into().unwrap());
 offset += 8;
 market.total_backing = u64::from_le_bytes(buffer[offset..offset+8].try_into().unwrap());
 offset += 8;
 market.accumulated_fees = u64::from_le_bytes(buffer[offset..offset+8].try_into().unwrap());
 offset += 8;
 market.next_position_id = u64::from_le_bytes(buffer[offset..offset+8].try_into().unwrap());
 offset += 8;
 market.total_volume = u64::from_le_bytes(buffer[offset..offset+8].try_into().unwrap());
 offset += 8;
 market.status = buffer[offset];
 offset += 1;
 market.resolution_mean = u64::from_le_bytes(buffer[offset..offset+8].try_into().unwrap());
 offset += 8;
 market.resolution_variance = u64::from_le_bytes(buffer[offset..offset+8].try_into().unwrap());
 Some(market)
 } else {
 None
 }
}
fn save_market(market_id: u64, market: &Market) {
 let key = get_market_key(market_id);
 let mut buffer = [0u8; 200];
 let mut offset = 0;
 buffer[offset..offset+20].copy_from_slice(&market.creator);
 offset += 20;
 buffer[offset..offset+8].copy_from_slice(&market.creation_time.to_le_bytes());
 offset += 8;
 buffer[offset..offset+8].copy_from_slice(&market.close_time.to_le_bytes());
 offset += 8;
 buffer[offset..offset+8].copy_from_slice(&market.k_norm.to_le_bytes());
 offset += 8;
 buffer[offset..offset+8].copy_from_slice(&market.b_backing.to_le_bytes());
 offset += 8;
 buffer[offset..offset+8].copy_from_slice(&market.current_mean.to_le_bytes());
 offset += 8;
 buffer[offset..offset+8].copy_from_slice(&market.current_variance.to_le_bytes());
 offset += 8;
 buffer[offset..offset+8].copy_from_slice(&market.total_lp_shares.to_le_bytes());
 offset += 8;
 buffer[offset..offset+8].copy_from_slice(&market.total_backing.to_le_bytes());
 offset += 8;
 buffer[offset..offset+8].copy_from_slice(&market.accumulated_fees.to_le_bytes());
 offset += 8;
 buffer[offset..offset+8].copy_from_slice(&market.next_position_id.to_le_bytes());
 offset += 8;
 buffer[offset..offset+8].copy_from_slice(&market.total_volume.to_le_bytes());
 offset += 8;
 buffer[offset] = market.status;
 offset += 1;
 buffer[offset..offset+8].copy_from_slice(&market.resolution_mean.to_le_bytes());
 offset += 8;
 buffer[offset..offset+8].copy_from_slice(&market.resolution_variance.to_le_bytes());
 offset += 8;
 api::set_storage(
 StorageFlags::empty(),
 &key,
 &buffer[..offset],
 );
}
fn save_position(position: &Position) {
 let key = get_position_key(position.position_id);
 let mut buffer = [0u8; 250];
 let mut offset = 0;
 buffer[offset..offset+8].copy_from_slice(&position.position_id.to_le_bytes());
 offset += 8;
 buffer[offset..offset+20].copy_from_slice(&position.trader);
 offset += 20;
 buffer[offset..offset+8].copy_from_slice(&position.market_id.to_le_bytes());
 offset += 8;
 buffer[offset..offset+8].copy_from_slice(&position.from_mean.to_le_bytes());
 offset += 8;
 buffer[offset..offset+8].copy_from_slice(&position.from_variance.to_le_bytes());
 offset += 8;
 buffer[offset..offset+8].copy_from_slice(&position.to_mean.to_le_bytes());
 offset += 8;
 buffer[offset..offset+8].copy_from_slice(&position.to_variance.to_le_bytes());
 offset += 8;
 buffer[offset..offset+8].copy_from_slice(&position.size.to_le_bytes());
 offset += 8;
 buffer[offset..offset+8].copy_from_slice(&position.collateral_locked.to_le_bytes());
 offset += 8;
 buffer[offset..offset+8].copy_from_slice(&position.cost_basis.to_le_bytes());
 offset += 8;
 buffer[offset] = position.is_open;
 offset += 1;
 buffer[offset..offset+8].copy_from_slice(&position.opened_at.to_le_bytes());
 offset += 8;
 buffer[offset..offset+8].copy_from_slice(&position.closed_at.to_le_bytes());
 offset += 8;
 buffer[offset..offset+8].copy_from_slice(&position.exit_value.to_le_bytes());
 offset += 8;
 buffer[offset..offset+8].copy_from_slice(&position.fees_paid.to_le_bytes());
 offset += 8;
 buffer[offset..offset+8].copy_from_slice(&position.realized_pnl.to_le_bytes());
 offset += 8;
 buffer[offset] = position.claimed;
 offset += 1;
 api::set_storage(
 StorageFlags::empty(),
 &key,
 &buffer[..offset],
 );
}
fn load_position(position_id: u64) -> Option<Position> {
 let key = get_position_key(position_id);
 let mut buffer = [0u8; 250];
 let result = api::get_storage(
 StorageFlags::empty(),
 &key,
 &mut &mut buffer[..],
 );
 if result.is_err() {
 return None;
 }
 let has_data = buffer[8..28].iter().any(|&b| b != 0);
 if !has_data {
 return None;
 }
 let mut offset = 0;
 let position_id = match buffer.get(offset..offset+8) {
 Some(slice) => match slice.try_into() {
 Ok(arr) => u64::from_le_bytes(arr),
 Err(_) => return None,
 },
 None => return None,
 };
 offset += 8;
 let mut trader = [0u8; 20];
 match buffer.get(offset..offset+20) {
 Some(slice) => trader.copy_from_slice(slice),
 None => return None,
 }
 offset += 20;
 let market_id = match buffer.get(offset..offset+8) {
 Some(slice) => match slice.try_into() {
 Ok(arr) => u64::from_le_bytes(arr),
 Err(_) => return None,
 },
 None => return None,
 };
 offset += 8;
 let from_mean = match buffer.get(offset..offset+8) {
 Some(slice) => match slice.try_into() {
 Ok(arr) => u64::from_le_bytes(arr),
 Err(_) => return None,
 },
 None => return None,
 };
 offset += 8;
 let from_variance = match buffer.get(offset..offset+8) {
 Some(slice) => match slice.try_into() {
 Ok(arr) => u64::from_le_bytes(arr),
 Err(_) => return None,
 },
 None => return None,
 };
 offset += 8;
 let to_mean = match buffer.get(offset..offset+8) {
 Some(slice) => match slice.try_into() {
 Ok(arr) => u64::from_le_bytes(arr),
 Err(_) => return None,
 },
 None => return None,
 };
 offset += 8;
 let to_variance = match buffer.get(offset..offset+8) {
 Some(slice) => match slice.try_into() {
 Ok(arr) => u64::from_le_bytes(arr),
 Err(_) => return None,
 },
 None => return None,
 };
 offset += 8;
 let size = match buffer.get(offset..offset+8) {
 Some(slice) => match slice.try_into() {
 Ok(arr) => u64::from_le_bytes(arr),
 Err(_) => return None,
 },
 None => return None,
 };
 offset += 8;
 let collateral_locked = match buffer.get(offset..offset+8) {
 Some(slice) => match slice.try_into() {
 Ok(arr) => u64::from_le_bytes(arr),
 Err(_) => return None,
 },
 None => return None,
 };
 offset += 8;
 let cost_basis = match buffer.get(offset..offset+8) {
 Some(slice) => match slice.try_into() {
 Ok(arr) => u64::from_le_bytes(arr),
 Err(_) => return None,
 },
 None => return None,
 };
 offset += 8;
 let is_open = match buffer.get(offset) {
 Some(&b) => b,
 None => return None,
 };
 offset += 1;
 let opened_at = match buffer.get(offset..offset+8) {
 Some(slice) => match slice.try_into() {
 Ok(arr) => u64::from_le_bytes(arr),
 Err(_) => return None,
 },
 None => return None,
 };
 offset += 8;
 let closed_at = match buffer.get(offset..offset+8) {
 Some(slice) => match slice.try_into() {
 Ok(arr) => u64::from_le_bytes(arr),
 Err(_) => return None,
 },
 None => return None,
 };
 offset += 8;
 let exit_value = match buffer.get(offset..offset+8) {
 Some(slice) => match slice.try_into() {
 Ok(arr) => u64::from_le_bytes(arr),
 Err(_) => return None,
 },
 None => return None,
 };
 offset += 8;
 let fees_paid = match buffer.get(offset..offset+8) {
 Some(slice) => match slice.try_into() {
 Ok(arr) => u64::from_le_bytes(arr),
 Err(_) => return None,
 },
 None => return None,
 };
 offset += 8;
 let realized_pnl = match buffer.get(offset..offset+8) {
 Some(slice) => match slice.try_into() {
 Ok(arr) => i64::from_le_bytes(arr),
 Err(_) => return None,
 },
 None => return None,
 };
 offset += 8;
 let claimed = match buffer.get(offset) {
 Some(&b) => b,
 None => return None,
 };
 Some(Position {
 position_id,
 trader,
 market_id,
 from_mean,
 from_variance,
 to_mean,
 to_variance,
 size,
 collateral_locked,
 cost_basis,
 is_open,
 opened_at,
 closed_at,
 exit_value,
 fees_paid,
 realized_pnl,
 claimed,
 })
}
fn add_trader_position(trader: &[u8; 20], position_id: u64) {
 let count_key = get_trader_position_count_key(trader);
 let mut count_bytes = [0u8; 8];
 let _ = api::get_storage(
 StorageFlags::empty(),
 &count_key,
 &mut &mut count_bytes[..],
 );
 let count = u64::from_le_bytes(count_bytes);
 let pos_key = get_trader_positions_key(trader, count);
 api::set_storage(
 StorageFlags::empty(),
 &pos_key,
 &position_id.to_le_bytes(),
 );
 let new_count = count + 1;
 api::set_storage(
 StorageFlags::empty(),
 &count_key,
 &new_count.to_le_bytes(),
 );
}
fn save_market_metadata(market_id: u64, title: &str, description: &str, resolution_criteria: &str) {
 let key = get_metadata_key(market_id);
 let title_bytes = title.as_bytes();
 let desc_bytes = description.as_bytes();
 let criteria_bytes = resolution_criteria.as_bytes();
 let title_len = (title_bytes.len().min(255)) as u8;
 let desc_len = (desc_bytes.len().min(255)) as u8;
 let criteria_len = (criteria_bytes.len().min(255)) as u8;
 let total_len = 3 + title_len as usize + desc_len as usize + criteria_len as usize;
 let mut buffer = [0u8; MAX_STORAGE_VALUE];
 if total_len > MAX_STORAGE_VALUE {
 return; 
 }
 buffer[0] = title_len;
 buffer[1] = desc_len;
 buffer[2] = criteria_len;
 let mut offset = 3;
 buffer[offset..offset + title_len as usize].copy_from_slice(&title_bytes[..title_len as usize]);
 offset += title_len as usize;
 buffer[offset..offset + desc_len as usize].copy_from_slice(&desc_bytes[..desc_len as usize]);
 offset += desc_len as usize;
 buffer[offset..offset + criteria_len as usize].copy_from_slice(&criteria_bytes[..criteria_len as usize]);
 api::set_storage(
 StorageFlags::empty(),
 &key,
 &buffer[..total_len],
 );
}
fn handle_initialize() -> Vec<u8> {
 let mut caller = [0u8; 20];
 api::caller(&mut caller);
 let mut initialized = [0u8; 1];
 let _ = api::get_storage(
 StorageFlags::empty(),
 INITIALIZED_KEY,
 &mut &mut initialized[..],
 );
 if initialized[0] != 0 {
 return encode_revert("Already initialized");
 }
 api::set_storage(
 StorageFlags::empty(),
 OWNER_KEY,
 &caller,
 );
 api::set_storage(
 StorageFlags::empty(),
 INITIALIZED_KEY,
 &[1u8],
 );
 api::set_storage(
 StorageFlags::empty(),
 MARKET_COUNT_KEY,
 &0u64.to_le_bytes(),
 );
 api::set_storage(
 StorageFlags::empty(),
 POSITION_COUNT_KEY,
 &0u64.to_le_bytes(),
 );
 api::set_storage(
 StorageFlags::empty(),
 BLOCK_NUMBER_KEY,
 &1u64.to_le_bytes(),
 );
 encode(&[Token::Bool(true)])
}
fn handle_create_market(data: &[u8]) -> Vec<u8> {
 let tokens = match decode(&[
 ParamType::String, 
 ParamType::String, 
 ParamType::String, 
 ParamType::Uint(64), 
 ParamType::Uint(64), 
 ParamType::Uint(64), 
 ParamType::Uint(64), 
 ], data) {
 Ok(t) => t,
 Err(_) => return encode_revert("Invalid parameters"),
 };
 let title = tokens[0].clone().into_string().unwrap();
 let description = tokens[1].clone().into_string().unwrap();
 let resolution_criteria = tokens[2].clone().into_string().unwrap();
 let close_time = tokens[3].clone().into_uint().unwrap().as_u64();
 let k_norm = tokens[4].clone().into_uint().unwrap().as_u64();
 let initial_mean = tokens[5].clone().into_uint().unwrap().as_u64();
 let initial_variance = tokens[6].clone().into_uint().unwrap().as_u64();
 if initial_variance < MIN_VARIANCE {
 return encode_revert("Variance too small");
 }
 let mut value_bytes = [0u8; 32];
 api::value_transferred(&mut value_bytes);
 let value_wei = u64::from_le_bytes([
 value_bytes[0], value_bytes[1], value_bytes[2], value_bytes[3],
 value_bytes[4], value_bytes[5], value_bytes[6], value_bytes[7]
 ]);
 if value_wei == 0 {
 return encode_revert("Must provide initial backing");
 }
 let b_backing = match wei_to_fixed(value_wei) {
 Ok(v) => v,
 Err(_) => return encode_revert("Value conversion failed"),
 };
 if b_backing == 0 {
 return encode_revert("Backing too small");
 }
 let min_variance = match calculate_min_variance(k_norm, b_backing) {
 Ok(v) => v,
 Err(_) => return encode_revert("Min variance calculation failed"),
 };
 if initial_variance < min_variance {
 return encode_revert("Variance too low for backing constraint");
 }
 let _lambda = match calculate_lambda(k_norm, initial_variance) {
 Ok(v) => v,
 Err(_) => return encode_revert("Lambda calculation failed"),
 };
 let f_max = match calculate_f_max(k_norm, initial_variance) {
 Ok(v) => v,
 Err(_) => return encode_revert("F_max calculation failed"),
 };
 if f_max > b_backing {
 return encode_revert("Backing constraint violated");
 }
 let mut market_count_bytes = [0u8; 8];
 let _ = api::get_storage(
 StorageFlags::empty(),
 MARKET_COUNT_KEY,
 &mut &mut market_count_bytes[..],
 );
 let market_id = u64::from_le_bytes(market_count_bytes);
 let market = Market {
 creator: {
 let mut addr = [0u8; 20];
 api::caller(&mut addr);
 addr
 },
 creation_time: get_timestamp(),
 close_time,
 k_norm,
 b_backing,
 current_mean: initial_mean,
 current_variance: initial_variance,
 total_lp_shares: b_backing,
 total_backing: b_backing,
 accumulated_fees: 0,
 next_position_id: 0,
 total_volume: 0,
 status: MARKET_STATUS_OPEN,
 resolution_mean: 0,
 resolution_variance: 0,
 };
 save_market(market_id, &market);
 save_market_metadata(market_id, &title, &description, &resolution_criteria);
 let lp_key = get_lp_balance_key(market_id, &market.creator);
 api::set_storage(
 StorageFlags::empty(),
 &lp_key,
 &b_backing.to_le_bytes(),
 );
 let new_count = market_id + 1;
 api::set_storage(
 StorageFlags::empty(),
 MARKET_COUNT_KEY,
 &new_count.to_le_bytes(),
 );
 encode(&[Token::Uint(market_id.into())])
}
fn handle_calculate_trade(data: &[u8]) -> Vec<u8> {
 let tokens = match decode(&[
 ParamType::Uint(64), 
 ParamType::Uint(64), 
 ParamType::Uint(64), 
 ParamType::Uint(64), 
 ], data) {
 Ok(t) => t,
 Err(_) => return encode_revert("Invalid parameters"),
 };
 let market_id = tokens[0].clone().into_uint().unwrap().as_u64();
 let new_mean = tokens[1].clone().into_uint().unwrap().as_u64();
 let new_variance = tokens[2].clone().into_uint().unwrap().as_u64();
 let size = tokens[3].clone().into_uint().unwrap().as_u64();
 let market = match load_market(market_id) {
 Some(m) => m,
 None => return encode_revert("Market not found"),
 };
 if market.status != MARKET_STATUS_OPEN {
 return encode_revert("Market not open");
 }
 if new_variance < MIN_VARIANCE {
 return encode_revert("Variance too small");
 }
 let min_variance = match calculate_min_variance(market.k_norm, market.b_backing) {
 Ok(v) => v,
 Err(_) => return encode_revert("Min variance calculation failed"),
 };
 if new_variance < min_variance {
 return encode_revert("Variance too low");
 }
 let new_f_max = match calculate_f_max(market.k_norm, new_variance) {
 Ok(v) => v,
 Err(_) => return encode_revert("F_max calculation failed"),
 };
 if new_f_max > market.b_backing {
 return encode_revert("Backing constraint violated");
 }
 let (cost, fee, collateral) = match calculate_trade_cost(
 market.k_norm,
 market.current_mean, market.current_variance,
 new_mean, new_variance,
 size
 ) {
 Ok(v) => v,
 Err(_) => return encode_revert("Trade cost calculation failed"),
 };
 encode(&[
 Token::Uint(cost.into()),
 Token::Uint(fee.into()),
 Token::Uint(collateral.into()),
 ])
}
fn handle_trade_distribution(data: &[u8]) -> Vec<u8> {
 let tokens = match decode(&[
 ParamType::Uint(64), 
 ParamType::Uint(64), 
 ParamType::Uint(64), 
 ParamType::Uint(64), 
 ParamType::Uint(64), 
 ], data) {
 Ok(t) => t,
 Err(_) => return encode_revert("Invalid parameters"),
 };
 let market_id = tokens[0].clone().into_uint().unwrap().as_u64();
 let new_mean = tokens[1].clone().into_uint().unwrap().as_u64();
 let new_variance = tokens[2].clone().into_uint().unwrap().as_u64();
 let size = tokens[3].clone().into_uint().unwrap().as_u64();
 let max_cost = tokens[4].clone().into_uint().unwrap().as_u64();
 let mut market = match load_market(market_id) {
 Some(m) => m,
 None => return encode_revert("Market not found"),
 };
 if market.status != MARKET_STATUS_OPEN {
 return encode_revert("Market not open");
 }
 if get_timestamp() >= market.close_time {
 market.status = MARKET_STATUS_CLOSED;
 save_market(market_id, &market);
 return encode_revert("Market has closed");
 }
 if new_variance < MIN_VARIANCE {
 return encode_revert("Variance too small");
 }
 let min_variance = match calculate_min_variance(market.k_norm, market.b_backing) {
 Ok(v) => v,
 Err(_) => return encode_revert("Min variance calculation failed"),
 };
 if new_variance < min_variance {
 return encode_revert("Variance too low");
 }
 let entry_mean = market.current_mean;
 let entry_variance = market.current_variance;
 let new_f_max = match calculate_f_max(market.k_norm, new_variance) {
 Ok(v) => v,
 Err(_) => return encode_revert("F_max calculation failed"),
 };
 if new_f_max > market.b_backing {
 return encode_revert("Backing constraint violated");
 }
 let (cost, fee, collateral_required) = match calculate_trade_cost(
 market.k_norm,
 entry_mean, entry_variance,
 new_mean, new_variance,
 size
 ) {
 Ok(v) => v,
 Err(_) => return encode_revert("Trade cost calculation failed"),
 };
 if cost > max_cost {
 return encode_revert("Cost exceeds maximum");
 }
 let mut value_bytes = [0u8; 32];
 api::value_transferred(&mut value_bytes);
 let value_wei = u64::from_le_bytes([
 value_bytes[0], value_bytes[1], value_bytes[2], value_bytes[3],
 value_bytes[4], value_bytes[5], value_bytes[6], value_bytes[7]
 ]);
 let value_fixed = match wei_to_fixed(value_wei) {
 Ok(v) => v,
 Err(_) => return encode_revert("Value conversion failed"),
 };
 if value_fixed < cost {
 return encode_revert("Insufficient payment");
 }
 let mut caller = [0u8; 20];
 api::caller(&mut caller);
 let mut position_count_bytes = [0u8; 8];
 let _ = api::get_storage(
 StorageFlags::empty(),
 POSITION_COUNT_KEY,
 &mut &mut position_count_bytes[..],
 );
 let position_id = u64::from_le_bytes(position_count_bytes);
 let next_position_id = position_id + 1;
 api::set_storage(
 StorageFlags::empty(),
 POSITION_COUNT_KEY,
 &next_position_id.to_le_bytes(),
 );
 let position = Position {
 position_id,
 trader: caller,
 market_id,
 from_mean: entry_mean,
 from_variance: entry_variance,
 to_mean: new_mean,
 to_variance: new_variance,
 size,
 collateral_locked: collateral_required,
 cost_basis: cost,
 is_open: 1,
 opened_at: get_block_number(),
 closed_at: 0,
 exit_value: 0,
 fees_paid: fee,
 realized_pnl: 0i64,
 claimed: 0,
 };
 save_position(&position);
 add_trader_position(&caller, position.position_id);
 market.current_mean = new_mean;
 market.current_variance = new_variance;
 market.next_position_id += 1; 
 market.total_volume += cost;
 market.accumulated_fees += fee;
 save_market(market_id, &market);
 if value_fixed > cost {
 let excess_fixed = value_fixed - cost;
 if let Ok(excess_wei) = fixed_to_wei(excess_fixed) {
 let rounded_excess = round_wei_for_transfer(excess_wei);
 if rounded_excess > 0 {
 let transfer_amount = u256_bytes(rounded_excess);
 let deposit_limit = [0xffu8; 32];
 let _ = api::call(
 CallFlags::empty(),
 &caller,
 0,
 0,
 &deposit_limit,
 &transfer_amount,
 &[],
 None,
 );
 }
 }
 }
 encode(&[Token::Uint(position.position_id.into())])
}
fn handle_close_position(data: &[u8]) -> Vec<u8> {
 let tokens = match decode(&[ParamType::Uint(64)], data) {
 Ok(t) => t,
 Err(_) => return encode_revert("DEBUG1: Invalid parameters"),
 };
 let position_id = match tokens[0].clone().into_uint() {
 Some(uint) => uint.as_u64(),
 None => return encode_revert("DEBUG2: Invalid position ID"),
 };
 let mut position = match load_position(position_id) {
 Some(p) => p,
 None => return encode_revert("DEBUG3: Position not found"),
 };
 if position.is_open == 0 {
 return encode_revert("DEBUG4: Position already closed");
 }
 let mut caller = [0u8; 20];
 api::caller(&mut caller);
 if caller != position.trader {
 return encode_revert("DEBUG5: Not position owner");
 }
 let market = match load_market(position.market_id) {
 Some(m) => m,
 None => return encode_revert("DEBUG6: Market not found"),
 };
 let position_value = match calculate_position_value(
 &position,
 market.current_mean,
 market.current_variance,
 market.k_norm
 ) {
 Ok(v) => v,
 Err(e) => {
 let error_msg = if e == "Variance too small" {
 "DEBUG7: Variance too small"
 } else if e == "L2 norm is zero" {
 "DEBUG8: L2 norm is zero"
 } else if e == "Multiplication overflow" {
 "DEBUG9: Multiplication overflow"
 } else if e == "Division by zero" {
 "DEBUG10: Division by zero"
 } else if e == "Division overflow" {
 "DEBUG11: Division overflow"
 } else {
 "DEBUG12: Unknown calc error"
 };
 return encode_revert(error_msg);
 }
 };
 position.is_open = 0;
 position.closed_at = get_block_number();
 position.exit_value = position_value;
 if position_value >= position.cost_basis {
 position.realized_pnl = (position_value - position.cost_basis) as i64;
 } else {
 let loss = position.cost_basis - position_value;
 if loss > i64::MAX as u64 {
 return encode_revert("DEBUG13: P&L calculation overflow");
 }
 position.realized_pnl = -(loss as i64);
 }
 save_position(&position);
 if position_value > 0 {
 match fixed_to_wei(position_value) {
 Ok(position_value_wei) => {
 let rounded_value = round_wei_for_transfer(position_value_wei);
 if rounded_value >= MIN_TRANSFER_UNIT {
 let transfer_amount = u256_bytes(rounded_value);
 let deposit_limit = [0xffu8; 32];
 let result = api::call(
 CallFlags::empty(),
 &position.trader,
 0,
 0,
 &deposit_limit,
 &transfer_amount,
 &[],
 None,
 );
 if result.is_err() {
 }
 }
 },
 Err(_) => {
 }
 }
 }
 let value_u256 = ethabi::ethereum_types::U256::from(position_value);
 let value_token = Token::Uint(value_u256);
 let pnl_u256 = if position.realized_pnl >= 0 {
 ethabi::ethereum_types::U256::from(position.realized_pnl as u64)
 } else {
 let abs_value = position.realized_pnl.unsigned_abs();
 ethabi::ethereum_types::U256::MAX - ethabi::ethereum_types::U256::from(abs_value) + 1
 };
 let pnl_token = Token::Int(pnl_u256);
 encode(&[value_token, pnl_token])
}
fn handle_add_liquidity(data: &[u8]) -> Vec<u8> {
 let tokens = match decode(&[ParamType::Uint(64)], data) {
 Ok(t) => t,
 Err(_) => return encode_revert("Invalid parameters"),
 };
 let market_id = tokens[0].clone().into_uint().unwrap().as_u64();
 let mut market = match load_market(market_id) {
 Some(m) => m,
 None => return encode_revert("Market not found"),
 };
 if market.status != MARKET_STATUS_OPEN {
 return encode_revert("Market not open");
 }
 let mut value_bytes = [0u8; 32];
 api::value_transferred(&mut value_bytes);
 let value_wei = u64::from_le_bytes([
 value_bytes[0], value_bytes[1], value_bytes[2], value_bytes[3],
 value_bytes[4], value_bytes[5], value_bytes[6], value_bytes[7]
 ]);
 let value_fixed = match wei_to_fixed(value_wei) {
 Ok(v) => v,
 Err(_) => return encode_revert("Value conversion failed"),
 };
 if value_fixed == 0 {
 return encode_revert("Must provide liquidity");
 }
 let lp_shares_to_mint = if market.total_backing == 0 {
 value_fixed
 } else {
 match div_fixed(value_fixed, market.total_backing) {
 Ok(ratio) => match mul_fixed(ratio, market.total_lp_shares) {
 Ok(shares) => shares,
 Err(_) => return encode_revert("LP share calculation overflow"),
 },
 Err(_) => return encode_revert("LP ratio calculation failed"),
 }
 };
 market.total_backing += value_fixed;
 market.total_lp_shares += lp_shares_to_mint;
 market.b_backing = market.total_backing;
 let new_min_variance = match calculate_min_variance(market.k_norm, market.b_backing) {
 Ok(v) => v,
 Err(_) => return encode_revert("Min variance calculation failed"),
 };
 if market.current_variance < new_min_variance {
 return encode_revert("Market variance would violate constraint");
 }
 save_market(market_id, &market);
 let mut caller = [0u8; 20];
 api::caller(&mut caller);
 let lp_key = get_lp_balance_key(market_id, &caller);
 let mut current_balance_bytes = [0u8; 8];
 let _ = api::get_storage(
 StorageFlags::empty(),
 &lp_key,
 &mut &mut current_balance_bytes[..],
 );
 let current_balance = u64::from_le_bytes(current_balance_bytes);
 let new_balance = current_balance + lp_shares_to_mint;
 api::set_storage(
 StorageFlags::empty(),
 &lp_key,
 &new_balance.to_le_bytes(),
 );
 encode(&[Token::Uint(lp_shares_to_mint.into())])
}
fn handle_remove_liquidity(data: &[u8]) -> Vec<u8> {
 let tokens = match decode(&[
 ParamType::Uint(64), 
 ParamType::Uint(64), 
 ], data) {
 Ok(t) => t,
 Err(_) => return encode_revert("Invalid parameters"),
 };
 let market_id = tokens[0].clone().into_uint().unwrap().as_u64();
 let shares_to_burn = tokens[1].clone().into_uint().unwrap().as_u64();
 let mut market = match load_market(market_id) {
 Some(m) => m,
 None => return encode_revert("Market not found"),
 };
 let mut caller = [0u8; 20];
 api::caller(&mut caller);
 let lp_key = get_lp_balance_key(market_id, &caller);
 let mut balance_bytes = [0u8; 8];
 let _ = api::get_storage(
 StorageFlags::empty(),
 &lp_key,
 &mut &mut balance_bytes[..],
 );
 let balance = u64::from_le_bytes(balance_bytes);
 if balance == 0 {
 return encode_revert("No LP balance");
 }
 if shares_to_burn == 0 {
 return encode_revert("Cannot burn 0 shares");
 }
 if balance < shares_to_burn {
 return encode_revert("Insufficient LP shares");
 }
 let total_assets = market.total_backing + market.accumulated_fees;
 let backing_to_return = match div_fixed(shares_to_burn, market.total_lp_shares) {
 Ok(ratio) => match mul_fixed(ratio, total_assets) {
 Ok(amount) => amount,
 Err(_) => return encode_revert("Backing calculation overflow"),
 },
 Err(_) => return encode_revert("Ratio calculation failed"),
 };
 let backing_portion = match div_fixed(shares_to_burn, market.total_lp_shares) {
 Ok(ratio) => match mul_fixed(ratio, market.total_backing) {
 Ok(amount) => amount,
 Err(_) => return encode_revert("Backing portion overflow"),
 },
 Err(_) => return encode_revert("Ratio calculation failed"),
 };
 let fee_portion = backing_to_return.saturating_sub(backing_portion);
 let remaining_backing = market.total_backing.saturating_sub(backing_portion);
 let remaining_shares = market.total_lp_shares.saturating_sub(shares_to_burn);
 if remaining_shares > 0 && remaining_backing < market.k_norm {
 return encode_revert("Would violate minimum liquidity");
 }
 market.total_backing = remaining_backing;
 market.total_lp_shares = remaining_shares;
 market.b_backing = market.total_backing;
 market.accumulated_fees = market.accumulated_fees.saturating_sub(fee_portion);
 if market.total_backing > 0 {
 let new_min_variance = match calculate_min_variance(market.k_norm, market.b_backing) {
 Ok(v) => v,
 Err(_) => return encode_revert("Min variance calculation failed"),
 };
 if market.current_variance < new_min_variance {
 return encode_revert("Would violate variance constraint");
 }
 }
 save_market(market_id, &market);
 let new_balance = balance - shares_to_burn;
 api::set_storage(
 StorageFlags::empty(),
 &lp_key,
 &new_balance.to_le_bytes(),
 );
 if backing_to_return > 0 {
 if let Ok(backing_wei) = fixed_to_wei(backing_to_return) {
 let rounded_value = round_wei_for_transfer(backing_wei);
 if rounded_value > 0 {
 let transfer_amount = u256_bytes(rounded_value);
 let deposit_limit = [0xffu8; 32];
 let result = api::call(
 CallFlags::empty(),
 &caller,
 0,
 0,
 &deposit_limit,
 &transfer_amount,
 &[],
 None,
 );
 if result.is_err() {
 return encode_revert("Transfer failed");
 }
 }
 }
 }
 encode(&[Token::Uint(backing_to_return.into())])
}
fn handle_get_market_state(data: &[u8]) -> Vec<u8> {
 let tokens = match decode(&[ParamType::Uint(64)], data) {
 Ok(t) => t,
 Err(_) => return encode_revert("Invalid parameters"),
 };
 let market_id = tokens[0].clone().into_uint().unwrap().as_u64();
 let market = match load_market(market_id) {
 Some(m) => m,
 None => return encode_revert("Market not found"),
 };
 let lambda = calculate_lambda(market.k_norm, market.current_variance).unwrap_or(0);
 let f_max = calculate_f_max(market.k_norm, market.current_variance).unwrap_or(0);
 encode(&[
 Token::Uint(market.current_mean.into()),
 Token::Uint(market.current_variance.into()),
 Token::Uint(market.k_norm.into()),
 Token::Uint(market.b_backing.into()),
 Token::Uint(market.total_lp_shares.into()),
 Token::Uint(f_max.into()),
 Token::Uint(market.status.into()),
 Token::Uint(market.accumulated_fees.into()),
 Token::Uint(lambda.into()),
 ])
}
fn handle_evaluate_at(data: &[u8]) -> Vec<u8> {
 let tokens = match decode(&[
 ParamType::Uint(64), 
 ParamType::Uint(64), 
 ], data) {
 Ok(t) => t,
 Err(_) => return encode_revert("Invalid parameters"),
 };
 let market_id = tokens[0].clone().into_uint().unwrap().as_u64();
 let x = tokens[1].clone().into_uint().unwrap().as_u64();
 let market = match load_market(market_id) {
 Some(m) => m,
 None => return encode_revert("Market not found"),
 };
 let pdf_value = normal_pdf(x, market.current_mean, market.current_variance);
 let lambda = calculate_lambda(market.k_norm, market.current_variance).unwrap_or(0);
 let f_value = mul_fixed(lambda, pdf_value).unwrap_or(0);
 let capped_f_value = if f_value > market.b_backing {
 market.b_backing
 } else {
 f_value
 };
 encode(&[
 Token::Uint(pdf_value.into()),
 Token::Uint(capped_f_value.into()),
 ])
}
fn handle_get_cdf(data: &[u8]) -> Vec<u8> {
 let tokens = match decode(&[
 ParamType::Uint(64), 
 ParamType::Uint(64), 
 ], data) {
 Ok(t) => t,
 Err(_) => return encode_revert("Invalid parameters"),
 };
 let market_id = tokens[0].clone().into_uint().unwrap().as_u64();
 let x = tokens[1].clone().into_uint().unwrap().as_u64();
 let market = match load_market(market_id) {
 Some(m) => m,
 None => return encode_revert("Market not found"),
 };
 let cdf_value = normal_cdf(x, market.current_mean, market.current_variance);
 encode(&[Token::Uint(cdf_value.into())])
}
fn handle_get_expected_value(data: &[u8]) -> Vec<u8> {
 let tokens = match decode(&[ParamType::Uint(64)], data) {
 Ok(t) => t,
 Err(_) => return encode_revert("Invalid parameters"),
 };
 let market_id = tokens[0].clone().into_uint().unwrap().as_u64();
 let market = match load_market(market_id) {
 Some(m) => m,
 None => return encode_revert("Market not found"),
 };
 let expected_value = calculate_expected_value(market.current_mean, market.current_variance);
 encode(&[Token::Uint(expected_value.into())])
}
fn handle_get_bounds(data: &[u8]) -> Vec<u8> {
 let tokens = match decode(&[ParamType::Uint(64)], data) {
 Ok(t) => t,
 Err(_) => return encode_revert("Invalid parameters"),
 };
 let market_id = tokens[0].clone().into_uint().unwrap().as_u64();
 let market = match load_market(market_id) {
 Some(m) => m,
 None => return encode_revert("Market not found"),
 };
 let (lower, upper) = get_distribution_bounds(market.current_mean, market.current_variance);
 encode(&[
 Token::Uint(lower.into()),
 Token::Uint(upper.into()),
 ])
}
fn handle_get_market_info(data: &[u8]) -> Vec<u8> {
 let tokens = match decode(&[ParamType::Uint(64)], data) {
 Ok(t) => t,
 Err(_) => return encode_revert("Invalid parameters"),
 };
 let market_id = tokens[0].clone().into_uint().unwrap().as_u64();
 let market = match load_market(market_id) {
 Some(m) => m,
 None => return encode_revert("Market not found"),
 };
 let lambda = calculate_lambda(market.k_norm, market.current_variance).unwrap_or(0);
 let f_max = calculate_f_max(market.k_norm, market.current_variance).unwrap_or(0);
 let min_variance = calculate_min_variance(market.k_norm, market.b_backing).unwrap_or(0);
 let expected_value = calculate_expected_value(market.current_mean, market.current_variance);
 let (lower_bound, upper_bound) = get_distribution_bounds(market.current_mean, market.current_variance);
 encode(&[
 Token::Address(market.creator.into()),
 Token::Uint(market.creation_time.into()),
 Token::Uint(market.close_time.into()),
 Token::Uint(market.k_norm.into()),
 Token::Uint(market.b_backing.into()),
 Token::Uint(market.current_mean.into()),
 Token::Uint(market.current_variance.into()),
 Token::Uint(lambda.into()),
 Token::Uint(market.total_lp_shares.into()),
 Token::Uint(market.total_backing.into()),
 Token::Uint(market.accumulated_fees.into()),
 Token::Uint(f_max.into()),
 Token::Uint(min_variance.into()),
 Token::Uint(market.total_volume.into()),
 Token::Uint(market.status.into()),
 Token::Uint(expected_value.into()),
 Token::Uint(lower_bound.into()),
 Token::Uint(upper_bound.into()),
 ])
}
fn handle_get_position_value(data: &[u8]) -> Vec<u8> {
 let tokens = match decode(&[ParamType::Uint(64)], data) {
 Ok(t) => t,
 Err(_) => return encode_revert("Invalid parameters"),
 };
 let position_id = tokens[0].clone().into_uint().unwrap().as_u64();
 let position = match load_position(position_id) {
 Some(p) => p,
 None => return encode_revert("Position not found"),
 };
 if position.is_open == 0 {
 return encode(&[Token::Uint(position.exit_value.into())]);
 }
 let market = match load_market(position.market_id) {
 Some(m) => m,
 None => return encode_revert("Market not found"),
 };
 let current_value = match calculate_position_value(
 &position,
 market.current_mean,
 market.current_variance,
 market.k_norm
 ) {
 Ok(v) => v,
 Err(_) => 0,
 };
 encode(&[Token::Uint(current_value.into())])
}
fn handle_get_tvl(data: &[u8]) -> Vec<u8> {
 let tokens = match decode(&[ParamType::Uint(64)], data) {
 Ok(t) => t,
 Err(_) => return encode_revert("Invalid parameters"),
 };
 let market_id = tokens[0].clone().into_uint().unwrap().as_u64();
 let market = match load_market(market_id) {
 Some(m) => m,
 None => return encode_revert("Market not found"),
 };
 let tvl = market.total_backing + market.accumulated_fees;
 encode(&[Token::Uint(tvl.into())])
}
fn handle_resolve_market(data: &[u8]) -> Vec<u8> {
 let tokens = match decode(&[
 ParamType::Uint(64), 
 ParamType::Uint(64), 
 ParamType::Uint(64), 
 ], data) {
 Ok(t) => t,
 Err(_) => return encode_revert("Invalid parameters"),
 };
 let market_id = tokens[0].clone().into_uint().unwrap().as_u64();
 let final_mean = tokens[1].clone().into_uint().unwrap().as_u64();
 let final_variance = tokens[2].clone().into_uint().unwrap().as_u64();
 let mut market = match load_market(market_id) {
 Some(m) => m,
 None => return encode_revert("Market not found"),
 };
 let mut owner = [0u8; 20];
 let _ = api::get_storage(
 StorageFlags::empty(),
 OWNER_KEY,
 &mut &mut owner[..],
 );
 let mut caller = [0u8; 20];
 api::caller(&mut caller);
 if caller != owner {
 return encode_revert("Not authorized");
 }
 if market.status == MARKET_STATUS_RESOLVED {
 return encode_revert("Market already resolved");
 }
 if market.status == MARKET_STATUS_OPEN && get_timestamp() < market.close_time {
 return encode_revert("Market still open");
 }
 if final_variance < MIN_VARIANCE {
 return encode_revert("Resolution variance too small");
 }
 let min_variance = match calculate_min_variance(market.k_norm, market.b_backing) {
 Ok(v) => v,
 Err(_) => return encode_revert("Min variance calculation failed"),
 };
 if final_variance < min_variance {
 return encode_revert("Resolution variance too low");
 }
 market.status = MARKET_STATUS_RESOLVED;
 market.resolution_mean = final_mean;
 market.resolution_variance = final_variance;
 save_market(market_id, &market);
 encode(&[Token::Bool(true)])
}
fn handle_claim_winnings(data: &[u8]) -> Vec<u8> {
 let tokens = match decode(&[ParamType::Uint(64)], data) {
 Ok(t) => t,
 Err(_) => return encode_revert("Invalid parameters"),
 };
 let position_id = tokens[0].clone().into_uint().unwrap().as_u64();
 let mut position = match load_position(position_id) {
 Some(p) => p,
 None => return encode_revert("Position not found"),
 };
 let mut caller = [0u8; 20];
 api::caller(&mut caller);
 if caller != position.trader {
 return encode_revert("Not position owner");
 }
 if position.claimed == 1 {
 return encode_revert("Already claimed");
 }
 let market = match load_market(position.market_id) {
 Some(m) => m,
 None => return encode_revert("Market not found"),
 };
 if market.status != MARKET_STATUS_RESOLVED {
 return encode_revert("Market not resolved");
 }
 let final_value = if position.is_open == 1 {
 match calculate_position_value(
 &position,
 market.resolution_mean,
 market.resolution_variance,
 market.k_norm
 ) {
 Ok(v) => v,
 Err(_) => 0,
 }
 } else {
 position.exit_value
 };
 position.claimed = 1;
 save_position(&position);
 if final_value > 0 {
 if let Ok(final_value_wei) = fixed_to_wei(final_value) {
 let rounded_value = round_wei_for_transfer(final_value_wei);
 if rounded_value > 0 {
 let transfer_amount = u256_bytes(rounded_value);
 let deposit_limit = [0xffu8; 32];
 let result = api::call(
 CallFlags::empty(),
 &caller,
 0,
 0,
 &deposit_limit,
 &transfer_amount,
 &[],
 None,
 );
 if result.is_err() {
 return encode_revert("Transfer failed");
 }
 }
 }
 }
 encode(&[Token::Uint(final_value.into())])
}
fn handle_get_consensus(data: &[u8]) -> Vec<u8> {
 let tokens = match decode(&[
 ParamType::Uint(64), 
 ParamType::Uint(64), 
 ], data) {
 Ok(t) => t,
 Err(_) => return encode_revert("Invalid parameters"),
 };
 let market_id = tokens[0].clone().into_uint().unwrap().as_u64();
 let x = tokens[1].clone().into_uint().unwrap().as_u64();
 let market = match load_market(market_id) {
 Some(m) => m,
 None => return encode_revert("Market not found"),
 };
 let pdf_value = normal_pdf(x, market.current_mean, market.current_variance);
 let lambda = calculate_lambda(market.k_norm, market.current_variance).unwrap_or(0);
 let f_value = mul_fixed(lambda, pdf_value).unwrap_or(0);
 let capped_f_value = if f_value > market.b_backing {
 market.b_backing
 } else {
 f_value
 };
 let holdings = calculate_amm_holdings(x, &market);
 encode(&[
 Token::Uint(capped_f_value.into()),
 Token::Uint(holdings.into()),
 ])
}
fn handle_get_metadata(data: &[u8]) -> Vec<u8> {
 let tokens = match decode(&[ParamType::Uint(64)], data) {
 Ok(t) => t,
 Err(_) => return encode_revert("Invalid parameters"),
 };
 let market_id = tokens[0].clone().into_uint().unwrap().as_u64();
 let key = get_metadata_key(market_id);
 let mut buffer = [0u8; MAX_STORAGE_VALUE];
 let _ = api::get_storage(
 StorageFlags::empty(),
 &key,
 &mut &mut buffer[..],
 );
 let (title, description, resolution_criteria) = if buffer[0] == 0 && buffer[1] == 0 && buffer[2] == 0 {
 ("", "", "")
 } else {
 let title_len = buffer[0] as usize;
 let desc_len = buffer[1] as usize;
 let criteria_len = buffer[2] as usize;
 let mut offset = 3;
 let title = core::str::from_utf8(&buffer[offset..offset + title_len]).unwrap_or("");
 offset += title_len;
 let description = core::str::from_utf8(&buffer[offset..offset + desc_len]).unwrap_or("");
 offset += desc_len;
 let resolution_criteria = core::str::from_utf8(&buffer[offset..offset + criteria_len]).unwrap_or("");
 (title, description, resolution_criteria)
 };
 encode(&[
 Token::String(title.into()),
 Token::String(description.into()),
 Token::String(resolution_criteria.into()),
 ])
}
fn handle_get_market_count() -> Vec<u8> {
 let mut market_count_bytes = [0u8; 8];
 let _ = api::get_storage(
 StorageFlags::empty(),
 MARKET_COUNT_KEY,
 &mut &mut market_count_bytes[..],
 );
 let count = u64::from_le_bytes(market_count_bytes);
 encode(&[Token::Uint(count.into())])
}
fn handle_get_trader_positions(data: &[u8]) -> Vec<u8> {
 let tokens = match decode(&[ParamType::Address], data) {
 Ok(t) => t,
 Err(_) => return encode_revert("Invalid parameters"),
 };
 let trader_bytes = tokens[0].clone().into_address().unwrap();
 let mut trader = [0u8; 20];
 trader.copy_from_slice(&trader_bytes.0);
 let count_key = get_trader_position_count_key(&trader);
 let mut count_bytes = [0u8; 8];
 let _ = api::get_storage(
 StorageFlags::empty(),
 &count_key,
 &mut &mut count_bytes[..],
 );
 let count = u64::from_le_bytes(count_bytes);
 let mut position_ids = Vec::new();
 for i in 0..count {
 let pos_key = get_trader_positions_key(&trader, i);
 let mut pos_id_bytes = [0u8; 8];
 let _ = api::get_storage(
 StorageFlags::empty(),
 &pos_key,
 &mut &mut pos_id_bytes[..],
 );
 let pos_id = u64::from_le_bytes(pos_id_bytes);
 position_ids.push(Token::Uint(pos_id.into()));
 }
 encode(&[Token::Array(position_ids)])
}
fn handle_get_position(data: &[u8]) -> Vec<u8> {
 let tokens = match decode(&[ParamType::Uint(64)], data) {
 Ok(t) => t,
 Err(_) => return encode_revert("Invalid parameters"),
 };
 let position_id = tokens[0].clone().into_uint().unwrap().as_u64();
 match load_position(position_id) {
 Some(position) => {
 encode(&[
 Token::Uint(position.position_id.into()),
 Token::Address(position.trader.into()),
 Token::Uint(position.market_id.into()),
 Token::Uint(position.from_mean.into()),
 Token::Uint(position.from_variance.into()),
 Token::Uint(position.to_mean.into()),
 Token::Uint(position.to_variance.into()),
 Token::Uint(position.size.into()),
 Token::Uint(position.collateral_locked.into()),
 Token::Uint(position.cost_basis.into()),
 Token::Uint(position.opened_at.into()),
 Token::Uint(position.is_open.into()),
 Token::Uint(position.closed_at.into()),
 Token::Uint(position.exit_value.into()),
 Token::Uint(position.fees_paid.into()),
 Token::Int(if position.realized_pnl >= 0 {
 ethabi::ethereum_types::U256::from(position.realized_pnl as u64)
 } else {
 let abs_value = position.realized_pnl.unsigned_abs();
 ethabi::ethereum_types::U256::MAX - ethabi::ethereum_types::U256::from(abs_value) + 1
 }),
 Token::Uint(position.claimed.into()),
 ])
 }
 None => encode_revert("Position not found"),
 }
}
fn handle_get_lp_balance(data: &[u8]) -> Vec<u8> {
 let tokens = match decode(&[
 ParamType::Uint(64), 
 ParamType::Address, 
 ], data) {
 Ok(t) => t,
 Err(_) => return encode_revert("Invalid parameters"),
 };
 let market_id = tokens[0].clone().into_uint().unwrap().as_u64();
 let address_token = tokens[1].clone().into_address().unwrap();
 let mut address = [0u8; 20];
 address.copy_from_slice(address_token.as_bytes());
 let lp_key = get_lp_balance_key(market_id, &address);
 let mut balance_bytes = [0u8; 8];
 let result = api::get_storage(
 StorageFlags::empty(),
 &lp_key,
 &mut &mut balance_bytes[..],
 );
 let balance = if result.is_ok() {
 u64::from_le_bytes(balance_bytes)
 } else {
 0u64
 };
 encode(&[Token::Uint(balance.into())])
}
fn handle_get_amm_holdings(data: &[u8]) -> Vec<u8> {
 let tokens = match decode(&[
 ParamType::Uint(64), 
 ParamType::Uint(64), 
 ], data) {
 Ok(t) => t,
 Err(_) => return encode_revert("Invalid parameters"),
 };
 let market_id = tokens[0].clone().into_uint().unwrap().as_u64();
 let x = tokens[1].clone().into_uint().unwrap().as_u64();
 let market = match load_market(market_id) {
 Some(m) => m,
 None => return encode_revert("Market not found"),
 };
 let holdings = calculate_amm_holdings(x, &market);
 encode(&[Token::Uint(holdings.into())])
}
#[polkavm_export]
pub extern "C" fn deploy() {
 api::set_storage(
 StorageFlags::empty(),
 MARKET_COUNT_KEY,
 &0u64.to_le_bytes(),
 );
 api::set_storage(
 StorageFlags::empty(),
 POSITION_COUNT_KEY,
 &0u64.to_le_bytes(),
 );
}
#[polkavm_export]
pub extern "C" fn call() {
 let length = api::call_data_size() as usize;
 if length == 0 {
 api::return_value(ReturnFlags::empty(), &[]);
 return;
 }
 if length < 4 {
 api::return_value(ReturnFlags::REVERT, b"Invalid input");
 return;
 }
 let mut selector = [0u8; 4];
 api::call_data_copy(&mut selector, 0);
 let mut data = [0u8; MAX_INPUT];
 let data_len = length.saturating_sub(4).min(MAX_INPUT);
 if data_len > 0 {
 api::call_data_copy(&mut data[..data_len], 4);
 }
 let result = match selector {
 INITIALIZE_SELECTOR => handle_initialize(),
 CREATE_MARKET_SELECTOR => handle_create_market(&data[..data_len]),
 TRADE_DISTRIBUTION_SELECTOR => handle_trade_distribution(&data[..data_len]),
 ADD_LIQUIDITY_SELECTOR => handle_add_liquidity(&data[..data_len]),
 REMOVE_LIQUIDITY_SELECTOR => handle_remove_liquidity(&data[..data_len]),
 GET_MARKET_STATE_SELECTOR => handle_get_market_state(&data[..data_len]),
 GET_CONSENSUS_SELECTOR => handle_get_consensus(&data[..data_len]),
 GET_METADATA_SELECTOR => handle_get_metadata(&data[..data_len]),
 GET_MARKET_COUNT_SELECTOR => handle_get_market_count(),
 GET_TRADER_POSITIONS_SELECTOR => handle_get_trader_positions(&data[..data_len]),
 CLOSE_POSITION_SELECTOR => handle_close_position(&data[..data_len]),
 GET_POSITION_SELECTOR => handle_get_position(&data[..data_len]),
 RESOLVE_MARKET_SELECTOR => handle_resolve_market(&data[..data_len]),
 CLAIM_WINNINGS_SELECTOR => handle_claim_winnings(&data[..data_len]),
 CALCULATE_TRADE_SELECTOR => handle_calculate_trade(&data[..data_len]),
 GET_LP_BALANCE_SELECTOR => handle_get_lp_balance(&data[..data_len]),
 GET_AMM_HOLDINGS_SELECTOR => handle_get_amm_holdings(&data[..data_len]),
 EVALUATE_AT_SELECTOR => handle_evaluate_at(&data[..data_len]),
 GET_CDF_SELECTOR => handle_get_cdf(&data[..data_len]),
 GET_EXPECTED_VALUE_SELECTOR => handle_get_expected_value(&data[..data_len]),
 GET_BOUNDS_SELECTOR => handle_get_bounds(&data[..data_len]),
 GET_MARKET_INFO_SELECTOR => handle_get_market_info(&data[..data_len]),
 GET_POSITION_VALUE_SELECTOR => handle_get_position_value(&data[..data_len]),
 GET_TVL_SELECTOR => handle_get_tvl(&data[..data_len]),
 _ => Vec::new(), 
 };
 if result.is_empty() {
 api::return_value(ReturnFlags::empty(), &[]);
 } else if result.starts_with(&[0x08, 0xc3, 0x79, 0xa0]) {
 api::return_value(ReturnFlags::REVERT, &result);
 } else {
 api::return_value(ReturnFlags::empty(), &result);
 }
}
#[panic_handler]
fn panic(_info: &core::panic::PanicInfo) -> ! {
 let error = encode_revert("Contract panic");
 api::return_value(ReturnFlags::REVERT, &error);
 unsafe {
 core::arch::asm!("unimp");
 core::hint::unreachable_unchecked();
 }
}