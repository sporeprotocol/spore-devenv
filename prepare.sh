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

# If a commit hash is provided, use the provided commit hash
if [ -n "$commit_hash" ]; then
    echo "Switching to commit hash: $commit_hash"
    
    # Clone the repository and enter the directory
    git clone $repo_url
    cd spore-contract

    # Get the list of parent commits of a merge commit
    parent_commits=($(git log --pretty=format:%P -n 1 $commit_hash))
    # Output parent commit list
    echo "Parent commits: ${parent_commits[@]}"

    # Check if it is a merge commit
    if [ "${#parent_commits[@]}" -gt 1 ]; then
        # Process merge commits, selecting the first parent commit
        parent_commit=${parent_commits[0]}
        git checkout $parent_commit
        echo "Switched to parent commit: $parent_commit"

        # Get the latest commit hash
        latest_commit=$(git log -n 1 --pretty=format:%H)
        echo "Latest commit hash: $latest_commit"

        # Switch to latest commit
        git checkout $latest_commit
        echo "Switched to latest commit: $latest_commit"
    else
        # For ordinary submissions, switch directly
        git checkout $GITHUB_SHA
        echo "Switched to commit: $GITHUB_SHA"
    fi
else
    # No commit hash provided
    echo "No commit hash provided."
fi


# Build spore-contract
cargo install cross --git https://github.com/cross-rs/cross
cargo install ckb-capsule --git https://github.com/nervosnetwork/capsule.git --tag v0.10.2
capsule build --release

npm install
npm run build:lumos
