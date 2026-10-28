import fs from 'node:fs';
import solc from 'solc';
import { keccak256 } from 'ethers';

const filename = 'QKIMinerTown.sol';
const settings = {
  optimizer: { enabled: true, runs: 200 },
  viaIR: true,
  evmVersion: 'petersburg',
  outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object', 'evm.deployedBytecode.object'] } },
};
const input = { language: 'Solidity', sources: { [filename]: { content: fs.readFileSync(`dist/contracts/${filename}`, 'utf8') } }, settings };
const compiled = JSON.parse(solc.compile(JSON.stringify(input)));
const errors = (compiled.errors || []).filter(e => e.severity === 'error');
if (errors.length) throw new Error(errors.map(e => e.formattedMessage).join('\n'));
const contract = compiled.contracts[filename].QKIMinerTown;
const runtime = '0x' + contract.evm.deployedBytecode.object;
if ((runtime.length - 2) / 2 > 24576) throw new Error('Contract exceeds EIP-170 limit');
const artifact = { contractName: 'QKIMinerTown', compiler: solc.version(), evmVersion: settings.evmVersion, abi: contract.abi, bytecode: '0x' + contract.evm.bytecode.object, deployedBytecode: runtime, runtimeHash: keccak256(runtime) };
fs.writeFileSync('dist/contracts/QKIMinerTown.json', JSON.stringify(artifact));
fs.mkdirSync('dist/vendor', { recursive: true });
fs.copyFileSync('node_modules/ethers/dist/ethers.min.js', 'dist/vendor/ethers.js');
fs.copyFileSync('node_modules/ethers/LICENSE.md', 'dist/vendor/ethers-LICENSE.md');
console.log(`Compiled ${filename}: ${(runtime.length - 2) / 2} runtime bytes; target ${settings.evmVersion}`);
