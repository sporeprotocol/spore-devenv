# spore-devenv

## Prepare Script

This script automates the process of cloning a Git repository, checking out a specific branch or commit hash, and can be customized with various options.

### Usage Examples

You can use command-line options to override default settings:

- **Specify Branch:**
  ```bash
  bash prepare.sh -b master

- **Specify Commit Hash:**
  ```bash
  bash prepare.sh -c abcdef123456

- **Specify Repository URL:**
  ```bash
  bash prepare.sh -r https://github.com/your-username/your-repo.git

- **Combined Options:**
    - **Specify Branch and Commit Hash:**
      ```bash
      bash prepare.sh -b develop -c abcdef123456
    - **Change Repository URL and Specify Commit Hash:**
      ```bash
      bash prepare.sh -r https://github.com/your-username/your-repo.git -c abcdef123456

Generate spore dev data
```shell
npm i

npm run test:start

npm run test:e2e
```

clean env
```shell
npm run test:stop
```
