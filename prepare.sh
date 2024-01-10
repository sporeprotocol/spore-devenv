#!/bin/bash

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

    # Clone the repository and enter the directory
    git clone $repo_url
    cd spore-contract

    # Check if it's a merge commit
    is_merge_commit=$(git cat-file -p $commit_hash | grep "^parent" | wc -l)

    if [ "$is_merge_commit" -gt 0 ]; then
        # Handle merge commit, assuming switching to the first parent commit
        parent_commit=$(git rev-list --parents -n 1 $commit_hash | awk '{print $2}')
        git checkout -b new_branch $parent_commit
        echo "Switched to branch from merge commit: $parent_commit"
    else
        # Switch directly for a regular commit
        git checkout $commit_hash
        echo "Switched to commit: $commit_hash"
    fi

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
