#![no_std]
#![no_main]

extern crate alloc;
use alloc::{vec, vec::Vec};
use polkavm_derive::polkavm_export;
use simplealloc::SimpleAlloc;
use uapi::{HostFn, HostFnImpl as api, input};

#[global_allocator]
static ALLOCATOR: SimpleAlloc<102400> = SimpleAlloc::new(); // Increased from 20KB to 100KB

mod distribution_market_v2 {
    use super::*;
    use alloc::boxed::Box;
    use ethabi::{encode, decode, Token, ParamType};
    use uapi::{StorageFlags, ReturnFlags};

    // Constants for fixed-point math
    const PRECISION: u64 = 1_000_000_000; // 9 decimal places
    const SQRT_PRECISION: u64 = 31_622; // sqrt(10^9)
    const PI_FIXED: u64 = 3_141_592_654;
    const SQRT_2PI_FIXED: u64 = 2_506_628_275;
    const MAX_BASES: usize = 10; // Maximum Gaussian bases per distribution

    // Storage keys - using structured approach for scalability
    const KEY_PREFIX_MARKET: u8 = 0x10;
    const KEY_PREFIX_POSITION: u8 = 0x20;
    const KEY_PREFIX_STATS: u8 = 0x30;
    const KEY_PREFIX_METADATA: u8 = 0x40;
    const KEY_PREFIX_LP: u8 = 0x50;
    
    const KEY_MARKET_COUNT: [u8; 32] = [KEY_PREFIX_MARKET, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    const KEY_POSITION_COUNT: [u8; 32] = [KEY_PREFIX_POSITION, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

    // Events (stored as logs for UI updates)
    const EVENT_MARKET_CREATED: u8 = 1;
    const EVENT_POSITION_CREATED: u8 = 2;
    const EVENT_POSITION_TRANSFERRED: u8 = 3;
    const EVENT_MARKET_RESOLVED: u8 = 4;
    const EVENT_LIQUIDITY_ADDED: u8 = 5;
    const EVENT_LIQUIDITY_REMOVED: u8 = 6;
    const EVENT_TRADE_EXECUTED: u8 = 7;

    // Function selectors
    const SELECTOR_CREATE_MARKET: [u8; 4] = [0x12, 0x34, 0x56, 0x78];
    const SELECTOR_TRADE: [u8; 4] = [0x23, 0x45, 0x67, 0x89];
    const SELECTOR_GET_POSITION: [u8; 4] = [0x34, 0x56, 0x78, 0x9a];
    const SELECTOR_TRANSFER_POSITION: [u8; 4] = [0x45, 0x67, 0x89, 0xab];
    const SELECTOR_EVALUATE_DISTRIBUTION: [u8; 4] = [0x56, 0x78, 0x9a, 0xbc];
    const SELECTOR_GET_MARKET_STATE: [u8; 4] = [0x67, 0x89, 0xab, 0xcd];
    const SELECTOR_ADD_LIQUIDITY: [u8; 4] = [0x78, 0x9a, 0xbc, 0xde];
    const SELECTOR_REMOVE_LIQUIDITY: [u8; 4] = [0x89, 0xab, 0xcd, 0xef];
    const SELECTOR_GET_EXIT_QUOTE: [u8; 4] = [0x9a, 0xbc, 0xde, 0xf0];
    const SELECTOR_EXECUTE_EXIT: [u8; 4] = [0xab, 0xcd, 0xef, 0x01];
    const SELECTOR_GET_MARKET_STATS: [u8; 4] = [0xbc, 0xde, 0xf0, 0x12];
    const SELECTOR_BATCH_EVALUATE: [u8; 4] = [0xcd, 0xef, 0x01, 0x23];

    /// Gaussian basis function component
    #[derive(Clone)]
    struct GaussianBasis {
        center: u64,    // μ in fixed-point
        width: u64,     // σ in fixed-point  
        weight: u64,    // w in fixed-point
    }

    /// Distribution composed of multiple Gaussian bases
    #[derive(Clone)]
    struct Distribution {
        bases: Vec<GaussianBasis>,
        l2_norm: u64,  // Pre-computed L2 norm
    }

    /// Market parameters
    struct Market {
        id: u64,
        backing_amount: u64,
        norm_constant: u64,
        current_distribution: Distribution,
        total_liquidity: u64,
        participant_count: u64,
        volume: u64,
        created_at: u64,
        resolved: bool,
        outcome: u64,
    }

    /// Position held by a trader
    struct Position {
        id: u64,
        market_id: u64,
        owner: [u8; 20],
        distribution: Distribution,
        amount: u64,
        created_at: u64,
    }

    /// Market statistics for UI
    struct MarketStats {
        total_volume: u64,
        participant_count: u64,
        avg_trade_size: u64,
        last_trade_time: u64,
        liquidity_depth: u64,
    }

    // Helper functions for storage keys
    fn market_key(market_id: u64) -> [u8; 32] {
        let mut key = [0u8; 32];
        key[0] = KEY_PREFIX_MARKET;
        key[1] = 2; // Market data
        key[2..10].copy_from_slice(&market_id.to_le_bytes());
        key
    }

    fn position_key(position_id: u64) -> [u8; 32] {
        let mut key = [0u8; 32];
        key[0] = KEY_PREFIX_POSITION;
        key[1] = 2; // Position data
        key[2..10].copy_from_slice(&position_id.to_le_bytes());
        key
    }

    fn user_positions_key(user: [u8; 20], market_id: u64) -> [u8; 32] {
        let mut key = [0u8; 32];
        key[0] = KEY_PREFIX_POSITION;
        key[1] = 3; // User positions
        key[2..22].copy_from_slice(&user);
        key[22..30].copy_from_slice(&market_id.to_le_bytes());
        key
    }

    fn market_stats_key(market_id: u64) -> [u8; 32] {
        let mut key = [0u8; 32];
        key[0] = KEY_PREFIX_STATS;
        key[1] = 2;
        key[2..10].copy_from_slice(&market_id.to_le_bytes());
        key
    }

    /// Create a new prediction market
    fn create_market(backing_amount: u64, norm_constant: u64) -> u64 {
        let mut market_count_bytes = [0u8; 8];
        api::get_storage(StorageFlags::empty(), &KEY_MARKET_COUNT, &mut &mut market_count_bytes[..]);
        let market_count = u64::from_le_bytes(market_count_bytes);
        
        let market_id = market_count + 1;
        
        // Initialize with uniform distribution - simplified for debugging
        let initial_basis = GaussianBasis {
            center: PRECISION,  // Center at 1.0
            width: PRECISION,   // Width of 1.0
            weight: PRECISION,  // Weight of 1.0
        };
        let initial_bases = vec![initial_basis];
        
        // Temporarily hardcode L2 norm to avoid calculation issues
        let initial_dist = Distribution {
            bases: initial_bases,
            l2_norm: PRECISION, // Hardcoded for now to test if L2 calculation is the issue
        };

        let market = Market {
            id: market_id,
            backing_amount,
            norm_constant,
            current_distribution: initial_dist,
            total_liquidity: 0,
            participant_count: 0,
            volume: 0,
            created_at: get_block_timestamp(),
            resolved: false,
            outcome: 0,
        };

        save_market(&market);
        api::set_storage(StorageFlags::empty(), &KEY_MARKET_COUNT, &market_id.to_le_bytes());
        
        emit_event(EVENT_MARKET_CREATED, &encode(&[
            Token::Uint(market_id.into()),
            Token::Uint(backing_amount.into()),
            Token::Uint(norm_constant.into()),
        ]));

        market_id
    }

    /// Execute a trade with a Gaussian mixture distribution
    fn trade(market_id: u64, trader: [u8; 20], bases: Vec<GaussianBasis>, amount: u64) -> u64 {
        assert!(bases.len() <= MAX_BASES, "Too many Gaussian bases");
        assert!(bases.len() > 0, "Distribution must have at least one basis");
        
        let mut market = load_market(market_id);
        assert!(!market.resolved, "Market is resolved");

        // Normalize weights to sum to 1
        let total_weight: u64 = bases.iter().map(|b| b.weight).sum();
        let normalized_bases: Vec<GaussianBasis> = bases.iter().map(|b| {
            GaussianBasis {
                center: b.center,
                width: b.width,
                weight: (b.weight * PRECISION) / total_weight,
            }
        }).collect();

        // Calculate L2 norm of new distribution
        let l2_norm = calculate_distribution_l2_norm(&normalized_bases);
        
        // Scale to maintain norm constraint
        let scale_factor = (market.norm_constant * PRECISION) / l2_norm;
        
        // Check backing constraint
        let max_value = get_distribution_max(&normalized_bases, scale_factor);
        assert!(max_value <= market.backing_amount, "Exceeds backing amount");

        // Create position
        let position = Position {
            id: get_next_position_id(),
            market_id,
            owner: trader,
            distribution: Distribution {
                bases: normalized_bases,
                l2_norm,
            },
            amount,
            created_at: get_block_timestamp(),
        };

        let position_id = position.id;
        save_position(&position);
        
        // Update market stats
        market.volume = market.volume.saturating_add(amount);
        if !has_user_traded(&trader, market_id) {
            market.participant_count += 1;
            mark_user_traded(&trader, market_id);
        }
        
        // Update market distribution (weighted average)
        market.current_distribution = merge_distributions(
            &market.current_distribution,
            &position.distribution,
            market.volume.saturating_sub(amount),
            amount
        );
        
        save_market(&market);
        update_market_stats(market_id, amount);
        
        emit_event(EVENT_TRADE_EXECUTED, &encode(&[
            Token::Uint(market_id.into()),
            Token::Address(trader.into()),
            Token::Uint(position_id.into()),
            Token::Uint(amount.into()),
        ]));

        position_id
    }

    /// Transfer a position to another address
    fn transfer_position(position_id: u64, from: [u8; 20], to: [u8; 20]) {
        let mut position = load_position(position_id);
        assert!(position.owner == from, "Not position owner");
        
        position.owner = to;
        save_position(&position);
        
        emit_event(EVENT_POSITION_TRANSFERRED, &encode(&[
            Token::Uint(position_id.into()),
            Token::Address(from.into()),
            Token::Address(to.into()),
        ]));
    }

    /// Evaluate a distribution at multiple points (batch operation)
    fn batch_evaluate(market_id: u64, points: Vec<u64>) -> Vec<u64> {
        let market = load_market(market_id);
        points.iter().map(|&x| {
            evaluate_distribution_at(&market.current_distribution, x)
        }).collect()
    }

    /// Calculate L2 norm of a Gaussian mixture
    fn calculate_distribution_l2_norm(bases: &Vec<GaussianBasis>) -> u64 {
        // For Gaussian mixture: ||f||²₂ = ΣᵢΣⱼ wᵢwⱼ * overlap(Gᵢ, Gⱼ)
        let mut norm_squared = 0u64;
        
        for i in 0..bases.len() {
            for j in 0..bases.len() {
                let overlap = gaussian_overlap(&bases[i], &bases[j]);
                let contribution = (bases[i].weight * bases[j].weight * overlap) / PRECISION;
                norm_squared = norm_squared.saturating_add(contribution);
            }
        }
        
        integer_sqrt(norm_squared)
    }

    /// Calculate overlap integral between two Gaussians
    fn gaussian_overlap(g1: &GaussianBasis, g2: &GaussianBasis) -> u64 {
        // Overlap = exp(-(μ₁-μ₂)²/(2(σ₁²+σ₂²))) / √(2π(σ₁²+σ₂²))
        let center_diff = if g1.center > g2.center { 
            g1.center - g2.center 
        } else { 
            g2.center - g1.center 
        };
        
        let var_sum = (g1.width * g1.width + g2.width * g2.width) / PRECISION;
        let exponent = (center_diff * center_diff) / (2 * var_sum);
        
        let exp_value = exp_negative_taylor(exponent);
        let denominator = integer_sqrt(var_sum * SQRT_2PI_FIXED * SQRT_2PI_FIXED / PRECISION);
        
        (exp_value * PRECISION) / denominator
    }

    /// Get maximum value of scaled distribution
    fn get_distribution_max(bases: &Vec<GaussianBasis>, scale: u64) -> u64 {
        // Maximum occurs at one of the centers
        bases.iter().map(|basis| {
            // At center: Gaussian = weight/(σ√(2π))
            let max_at_center = (basis.weight * PRECISION) / (basis.width * SQRT_2PI_FIXED / SQRT_PRECISION);
            (max_at_center * scale) / PRECISION
        }).max().unwrap_or(0)
    }

    /// Evaluate distribution at a point
    fn evaluate_distribution_at(dist: &Distribution, x: u64) -> u64 {
        let mut value = 0u64;
        
        for basis in &dist.bases {
            let gaussian_value = evaluate_gaussian(basis, x);
            value = value.saturating_add(gaussian_value);
        }
        
        value
    }

    /// Evaluate single Gaussian at a point
    fn evaluate_gaussian(basis: &GaussianBasis, x: u64) -> u64 {
        let diff = if x > basis.center { 
            x - basis.center 
        } else { 
            basis.center - x 
        };
        
        let variance = basis.width * basis.width / PRECISION;
        let exponent = (diff * diff) / (2 * variance);
        let exp_value = exp_negative_taylor(exponent);
        
        // Gaussian = weight * exp(-exponent) / (σ√(2π))
        (basis.weight * exp_value) / (basis.width * SQRT_2PI_FIXED / SQRT_PRECISION)
    }

    /// Merge two distributions with weights
    fn merge_distributions(dist1: &Distribution, dist2: &Distribution, weight1: u64, weight2: u64) -> Distribution {
        let total_weight = weight1 + weight2;
        let mut merged_bases = Vec::new();
        
        // Add weighted bases from first distribution
        for basis in &dist1.bases {
            merged_bases.push(GaussianBasis {
                center: basis.center,
                width: basis.width,
                weight: (basis.weight * weight1) / total_weight,
            });
        }
        
        // Add weighted bases from second distribution
        for basis in &dist2.bases {
            merged_bases.push(GaussianBasis {
                center: basis.center,
                width: basis.width,
                weight: (basis.weight * weight2) / total_weight,
            });
        }
        
        // Merge similar Gaussians to keep bases count manageable
        merged_bases = merge_similar_gaussians(merged_bases);
        
        Distribution {
            l2_norm: calculate_distribution_l2_norm(&merged_bases),
            bases: merged_bases,
        }
    }

    /// Merge Gaussians that are very similar
    fn merge_similar_gaussians(mut bases: Vec<GaussianBasis>) -> Vec<GaussianBasis> {
        if bases.len() <= MAX_BASES {
            return bases;
        }
        
        // Simple merging: combine bases with similar centers
        // This is a simplified implementation - a full version would use clustering
        bases.sort_by_key(|b| b.center);
        
        let mut merged = Vec::new();
        let mut i = 0;
        
        while i < bases.len() && merged.len() < MAX_BASES {
            let mut combined_weight = bases[i].weight;
            let mut combined_center = bases[i].center * bases[i].weight;
            let mut combined_width = bases[i].width * bases[i].weight;
            let mut _count = 1u64;
            
            // Look ahead for similar bases
            let mut j = i + 1;
            while j < bases.len() && merged.len() + (bases.len() - j) > MAX_BASES {
                let center_diff = bases[j].center.saturating_sub(bases[i].center);
                if center_diff < bases[i].width / 2 {
                    combined_weight += bases[j].weight;
                    combined_center += bases[j].center * bases[j].weight;
                    combined_width += bases[j].width * bases[j].weight;
                    _count += 1;
                    j += 1;
                } else {
                    break;
                }
            }
            
            merged.push(GaussianBasis {
                center: combined_center / combined_weight,
                width: combined_width / combined_weight,
                weight: combined_weight,
            });
            
            i = j;
        }
        
        // Add remaining bases if room
        while i < bases.len() && merged.len() < MAX_BASES {
            merged.push(bases[i].clone());
            i += 1;
        }
        
        merged
    }

    /// Get exit quote for a position
    fn get_exit_quote(position_id: u64) -> (u64, bool) {
        let position = load_position(position_id);
        let market = load_market(position.market_id);
        
        if market.resolved {
            // If resolved, calculate payout based on outcome
            let payout = calculate_resolved_payout(&position, market.outcome);
            return (payout, true);
        }
        
        // Calculate exit value based on current market state
        // This is simplified - full implementation would consider liquidity
        let overlap = distribution_overlap(&position.distribution, &market.current_distribution);
        let exit_value = (position.amount * overlap) / PRECISION;
        
        (exit_value, exit_value > 0)
    }

    /// Calculate payout for resolved market
    fn calculate_resolved_payout(position: &Position, outcome: u64) -> u64 {
        let value_at_outcome = evaluate_distribution_at(&position.distribution, outcome);
        (position.amount * value_at_outcome) / PRECISION
    }

    /// Calculate overlap between two distributions
    fn distribution_overlap(dist1: &Distribution, dist2: &Distribution) -> u64 {
        let mut total_overlap = 0u64;
        
        for b1 in &dist1.bases {
            for b2 in &dist2.bases {
                let overlap = gaussian_overlap(b1, b2);
                total_overlap += (b1.weight * b2.weight * overlap) / PRECISION;
            }
        }
        
        total_overlap
    }

    // Storage helpers
    fn save_market(market: &Market) {
        let data = encode_market(market);
        api::set_storage(StorageFlags::empty(), &market_key(market.id), &data);
    }

    fn load_market(market_id: u64) -> Market {
        let mut data = vec![0u8; 1024];
        api::get_storage(StorageFlags::empty(), &market_key(market_id), &mut &mut data[..]);
        decode_market(&data)
    }

    fn save_position(position: &Position) {
        let data = encode_position(position);
        api::set_storage(StorageFlags::empty(), &position_key(position.id), &data);
    }

    fn load_position(position_id: u64) -> Position {
        let mut data = vec![0u8; 1024];
        api::get_storage(StorageFlags::empty(), &position_key(position_id), &mut &mut data[..]);
        decode_position(&data)
    }

    fn get_next_position_id() -> u64 {
        let mut count_bytes = [0u8; 8];
        api::get_storage(StorageFlags::empty(), &KEY_POSITION_COUNT, &mut &mut count_bytes[..]);
        let count = u64::from_le_bytes(count_bytes);
        let new_id = count + 1;
        api::set_storage(StorageFlags::empty(), &KEY_POSITION_COUNT, &new_id.to_le_bytes());
        new_id
    }

    // Encoding/decoding helpers (simplified)
    fn encode_market(market: &Market) -> Vec<u8> {
        let mut data = Vec::new();
        data.extend_from_slice(&market.id.to_le_bytes());
        data.extend_from_slice(&market.backing_amount.to_le_bytes());
        data.extend_from_slice(&market.norm_constant.to_le_bytes());
        data.extend_from_slice(&market.total_liquidity.to_le_bytes());
        data.extend_from_slice(&market.participant_count.to_le_bytes());
        data.extend_from_slice(&market.volume.to_le_bytes());
        data.extend_from_slice(&market.created_at.to_le_bytes());
        data.push(if market.resolved { 1 } else { 0 });
        data.extend_from_slice(&market.outcome.to_le_bytes());
        
        // Encode distribution
        data.extend_from_slice(&(market.current_distribution.bases.len() as u64).to_le_bytes());
        for basis in &market.current_distribution.bases {
            data.extend_from_slice(&basis.center.to_le_bytes());
            data.extend_from_slice(&basis.width.to_le_bytes());
            data.extend_from_slice(&basis.weight.to_le_bytes());
        }
        data.extend_from_slice(&market.current_distribution.l2_norm.to_le_bytes());
        
        data
    }

    fn decode_market(data: &[u8]) -> Market {
        let mut offset = 0;
        
        let id = u64::from_le_bytes(data[offset..offset+8].try_into().unwrap());
        offset += 8;
        
        let backing_amount = u64::from_le_bytes(data[offset..offset+8].try_into().unwrap());
        offset += 8;
        
        let norm_constant = u64::from_le_bytes(data[offset..offset+8].try_into().unwrap());
        offset += 8;
        
        let total_liquidity = u64::from_le_bytes(data[offset..offset+8].try_into().unwrap());
        offset += 8;
        
        let participant_count = u64::from_le_bytes(data[offset..offset+8].try_into().unwrap());
        offset += 8;
        
        let volume = u64::from_le_bytes(data[offset..offset+8].try_into().unwrap());
        offset += 8;
        
        let created_at = u64::from_le_bytes(data[offset..offset+8].try_into().unwrap());
        offset += 8;
        
        let resolved = data[offset] == 1;
        offset += 1;
        
        let outcome = u64::from_le_bytes(data[offset..offset+8].try_into().unwrap());
        offset += 8;
        
        // Decode distribution
        let bases_count = u64::from_le_bytes(data[offset..offset+8].try_into().unwrap()) as usize;
        offset += 8;
        
        let mut bases = Vec::new();
        for _ in 0..bases_count {
            let center = u64::from_le_bytes(data[offset..offset+8].try_into().unwrap());
            offset += 8;
            let width = u64::from_le_bytes(data[offset..offset+8].try_into().unwrap());
            offset += 8;
            let weight = u64::from_le_bytes(data[offset..offset+8].try_into().unwrap());
            offset += 8;
            
            bases.push(GaussianBasis { center, width, weight });
        }
        
        let l2_norm = u64::from_le_bytes(data[offset..offset+8].try_into().unwrap());
        
        Market {
            id,
            backing_amount,
            norm_constant,
            current_distribution: Distribution { bases, l2_norm },
            total_liquidity,
            participant_count,
            volume,
            created_at,
            resolved,
            outcome,
        }
    }

    fn encode_position(position: &Position) -> Vec<u8> {
        let mut data = Vec::new();
        data.extend_from_slice(&position.id.to_le_bytes());
        data.extend_from_slice(&position.market_id.to_le_bytes());
        data.extend_from_slice(&position.owner);
        data.extend_from_slice(&position.amount.to_le_bytes());
        data.extend_from_slice(&position.created_at.to_le_bytes());
        
        // Encode distribution
        data.extend_from_slice(&(position.distribution.bases.len() as u64).to_le_bytes());
        for basis in &position.distribution.bases {
            data.extend_from_slice(&basis.center.to_le_bytes());
            data.extend_from_slice(&basis.width.to_le_bytes());
            data.extend_from_slice(&basis.weight.to_le_bytes());
        }
        data.extend_from_slice(&position.distribution.l2_norm.to_le_bytes());
        
        data
    }

    fn decode_position(data: &[u8]) -> Position {
        let mut offset = 0;
        
        let id = u64::from_le_bytes(data[offset..offset+8].try_into().unwrap());
        offset += 8;
        
        let market_id = u64::from_le_bytes(data[offset..offset+8].try_into().unwrap());
        offset += 8;
        
        let mut owner = [0u8; 20];
        owner.copy_from_slice(&data[offset..offset+20]);
        offset += 20;
        
        let amount = u64::from_le_bytes(data[offset..offset+8].try_into().unwrap());
        offset += 8;
        
        let created_at = u64::from_le_bytes(data[offset..offset+8].try_into().unwrap());
        offset += 8;
        
        // Decode distribution
        let bases_count = u64::from_le_bytes(data[offset..offset+8].try_into().unwrap()) as usize;
        offset += 8;
        
        let mut bases = Vec::new();
        for _ in 0..bases_count {
            let center = u64::from_le_bytes(data[offset..offset+8].try_into().unwrap());
            offset += 8;
            let width = u64::from_le_bytes(data[offset..offset+8].try_into().unwrap());
            offset += 8;
            let weight = u64::from_le_bytes(data[offset..offset+8].try_into().unwrap());
            offset += 8;
            
            bases.push(GaussianBasis { center, width, weight });
        }
        
        let l2_norm = u64::from_le_bytes(data[offset..offset+8].try_into().unwrap());
        
        Position {
            id,
            market_id,
            owner,
            distribution: Distribution { bases, l2_norm },
            amount,
            created_at,
        }
    }

    // Math helpers
    fn exp_negative_taylor(x: u64) -> u64 {
        if x == 0 { return PRECISION; }
        if x > 5 * PRECISION { return 0; }
        
        let x2 = (x * x) / PRECISION;
        let x3 = (x2 * x) / PRECISION;
        let x4 = (x3 * x) / PRECISION;
        
        let term1 = PRECISION;
        let term2 = x;
        let term3 = x2 / 2;
        let term4 = x3 / 6;
        let term5 = x4 / 24;
        
        term1.saturating_sub(term2)
            .saturating_add(term3)
            .saturating_sub(term4)
            .saturating_add(term5)
    }

    fn integer_sqrt(n: u64) -> u64 {
        if n == 0 { return 0; }
        
        let mut x = n;
        let mut y = (x + 1) / 2;
        
        while y < x {
            x = y;
            y = (x + n / x) / 2;
        }
        
        x
    }

    // Event emission
    fn emit_event(event_type: u8, data: &[u8]) {
        let mut event_data = vec![event_type];
        event_data.extend_from_slice(data);
        // Event emission disabled - Topics not available
    }

    // Placeholder functions
    fn get_block_timestamp() -> u64 {
        // In real implementation, would get from block context
        0
    }

    fn has_user_traded(user: &[u8; 20], market_id: u64) -> bool {
        let mut flag = [0u8; 1];
        let _ = api::get_storage(StorageFlags::empty(), &user_positions_key(*user, market_id), &mut &mut flag[..]);
        flag[0] == 1
    }

    fn mark_user_traded(user: &[u8; 20], market_id: u64) {
        api::set_storage(StorageFlags::empty(), &user_positions_key(*user, market_id), &[1u8]);
    }

    fn update_market_stats(_market_id: u64, _trade_amount: u64) {
        // Update aggregated statistics
        // In full implementation, would maintain running averages, etc.
    }

    /// Dispatch function calls
    pub fn dispatch(input: &[u8]) {
        if input.len() < 4 {
            panic!("Invalid input");
        }

        let selector: [u8; 4] = input[0..4].try_into().unwrap();
        let data = &input[4..];

        if selector == [0, 0, 0, 0] { panic!("unreachable") }
        else if selector == SELECTOR_CREATE_MARKET {
                let decoded = decode(&[ParamType::Uint(256), ParamType::Uint(256)], data)
                    .expect("Failed to decode params");
                
                let backing = decoded[0].clone().into_uint().unwrap().as_u64();
                let k = decoded[1].clone().into_uint().unwrap().as_u64();
                
                let market_id = create_market(backing, k);
                api::return_value(ReturnFlags::empty(), &encode(&[Token::Uint(market_id.into())]));
        } else if selector == SELECTOR_TRADE {
                let decoded = decode(&[
                    ParamType::Uint(256), // market_id
                    ParamType::Address,   // trader
                    ParamType::Array(Box::new(ParamType::Tuple(vec![
                        ParamType::Uint(256), // center
                        ParamType::Uint(256), // width
                        ParamType::Uint(256), // weight
                    ]))), // bases
                    ParamType::Uint(256), // amount
                ], data).expect("Failed to decode trade params");
                
                let market_id = decoded[0].clone().into_uint().unwrap().as_u64();
                let trader_token = decoded[1].clone();
                let mut trader = [0u8; 20];
                if let Token::Address(addr) = trader_token {
                    trader.copy_from_slice(&addr.0);
                }
                
                let mut bases = Vec::new();
                if let Token::Array(bases_tokens) = &decoded[2] {
                    for base_token in bases_tokens {
                        if let Token::Tuple(params) = base_token {
                            bases.push(GaussianBasis {
                                center: params[0].clone().into_uint().unwrap().as_u64(),
                                width: params[1].clone().into_uint().unwrap().as_u64(),
                                weight: params[2].clone().into_uint().unwrap().as_u64(),
                            });
                        }
                    }
                }
                
                let amount = decoded[3].clone().into_uint().unwrap().as_u64();
                
                let position_id = trade(market_id, trader, bases, amount);
                api::return_value(ReturnFlags::empty(), &encode(&[Token::Uint(position_id.into())]));
        } else if selector == SELECTOR_BATCH_EVALUATE {
                let decoded = decode(&[
                    ParamType::Uint(256),
                    ParamType::Array(Box::new(ParamType::Uint(256))),
                ], data).expect("Failed to decode params");
                
                let market_id = decoded[0].clone().into_uint().unwrap().as_u64();
                let mut points = Vec::new();
                
                if let Token::Array(point_tokens) = &decoded[1] {
                    for point in point_tokens {
                        points.push(point.clone().into_uint().unwrap().as_u64());
                    }
                }
                
                let values = batch_evaluate(market_id, points);
                let tokens: Vec<Token> = values.into_iter()
                    .map(|v| Token::Uint(v.into()))
                    .collect();
                    
                api::return_value(ReturnFlags::empty(), &encode(&[Token::Array(tokens)]));
        } else if selector == SELECTOR_GET_EXIT_QUOTE {
                let decoded = decode(&[ParamType::Uint(256)], data)
                    .expect("Failed to decode params");
                    
                let position_id = decoded[0].clone().into_uint().unwrap().as_u64();
                let (quote, can_exit) = get_exit_quote(position_id);
                
                api::return_value(ReturnFlags::empty(), &encode(&[
                    Token::Uint(quote.into()),
                    Token::Bool(can_exit),
                ]));
        } else {
            panic!("Unknown function selector");
        }
    }
}

#[no_mangle]
#[polkavm_export]
pub extern "C" fn deploy() {}

#[no_mangle]
#[polkavm_export]
pub extern "C" fn call() {
    input!(input: &[u8; 20480],);
    distribution_market_v2::dispatch(input);
}

#[panic_handler]
fn panic(_info: &core::panic::PanicInfo) -> ! {
    unsafe {
        core::arch::asm!("unimp");
        core::hint::unreachable_unchecked();
    }
}
