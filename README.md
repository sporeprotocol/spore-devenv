# spore_devnet

``` sh
sh prepare.sh
```

To build contracts, run:

``` sh
cd spore-contract
capsule build --release
```

generate data 
```shell
npm i
npm run build:lumos

npm run test:start

npm run test:deploy

npm run test:e2e
```

Data movement
``` sh
sh move_file.sh
```

clean env 
```shell
rm -rf tmp 
rm lumos.json
```