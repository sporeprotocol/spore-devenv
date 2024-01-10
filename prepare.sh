# Pull project lumos
git clone https://github.com/ckb-js/lumos.git
# Default branch is master
default_branch="master"
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
        -b|--branch)
        # Specify branch (overrides default)
        default_branch="$2"
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
    default_branch="$commit_hash"
fi

# Clone the repository
git clone $repo_url

# Enter the repository directory
cd spore-contract

# Log default branch
echo "Default branch is set to: $default_branch"

# Checkout the specified branch or commit hash
git checkout $default_branch

# Build spore-contract
cargo install cross --git https://github.com/cross-rs/cross
cargo install ckb-capsule --git https://github.com/nervosnetwork/capsule.git --tag v0.10.2
capsule build --release

npm install
npm run build:lumos
