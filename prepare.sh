#!/bin/bash

# Pull project lumos
git clone https://github.com/ckb-js/lumos.git

# Default repository URL
repo_url="https://github.com/sporeprotocol/spore-contract.git"

# Parse command-line arguments
while [[ $# -gt 0 ]]; do
    key="$1"

    case $key in
        -c|--commit-hash)
        # Specify commit hash
        commit_hash="$2"
        shift
        shift
        ;;
        -r|--repo-url)
        # Specify repository URL
        repo_url="$2"
        shift
        shift
        ;;
        *)
        # Unknown option
        echo "Unknown option: $1"
        exit 1
        ;;
    esac
done

# Use the provided commit hash if available
if [ -n "$commit_hash" ]; then
    echo "Switching to commit hash: $commit_hash"
    cd spore-contract
    git checkout $commit_hash
else
    # Clone the repository and enter the directory
    git clone $repo_url
    cd spore-contract

    # Get the current branch name
    branch_name=$(git rev-parse --abbrev-ref HEAD)
    echo "Current branch name: $branch_name"
fi


# Build spore-contract
cargo install cross --git https://github.com/cross-rs/cross
cargo install ckb-capsule --git https://github.com/nervosnetwork/capsule.git --tag v0.10.2
capsule build --release

npm install
npm run build:lumos
