git clone https://github.com/ckb-js/lumos.git
git clone https://github.com/Dawn-githup/spore-contract.git

cd spore-contract
cargo install cross --git https://github.com/cross-rs/cross
cargo install ckb-capsule --git https://github.com/nervosnetwork/capsule.git --tag v0.10.2
capsule build --release

npm run build:lumos