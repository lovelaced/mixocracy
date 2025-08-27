#!/bin/bash
set -e

# Build the contract
cargo build --release --bin mixocracy

# Link it
polkatool link --strip --output mixocracy.polkavm \
    target/riscv64emac-unknown-none-polkavm/release/mixocracy

echo "Contract built successfully: mixocracy.polkavm"