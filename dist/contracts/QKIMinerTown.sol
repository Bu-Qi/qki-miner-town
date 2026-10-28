// SPDX-License-Identifier: MIT
pragma solidity 0.8.38;

/// @title QKI Miner Town V1
/// @notice Address-owned game progress. No deposits, token approvals, payouts or administrator.
/// @dev All resource accounting is enforced here; browser-local saves cannot be imported.
contract QKIMinerTown {
    struct Mine { uint64 work; uint64 pending; uint8 level; uint8 assigned; }
    struct Player {
        bool exists;
        uint64 created;
        uint64 lastTick;
        uint64 score;
        uint64 delivered;
        uint8 machines;
        uint8 boosts;
        uint64 nextOrder;
        uint64[3] orders;
        // copper, energy, crystal, alloy, gear, drill, battery, beacon
        uint64[8] inventory;
        Mine[3] mines;
        uint64 collected;
        uint64 crafted;
        uint64 upgrades;
    }
    mapping(address => Player) private players;
    event Activity(address indexed player, bytes32 indexed action, uint256 detail);

    function gameId() external pure returns (bytes32) { return keccak256("QKI_MINER_TOWN_V1"); }

    function register() external {
        require(!players[msg.sender].exists, "ALREADY_REGISTERED");
        Player memory p;
        p.exists = true;
        p.created = uint64(block.timestamp);
        p.lastTick = uint64(block.timestamp);
        p.machines = 3;
        p.boosts = 3;
        p.nextOrder = 3;
        p.orders = [uint64(0), 1, 2];
        p.inventory[0] = 12; p.inventory[1] = 8; p.inventory[2] = 2;
        for (uint256 i; i < 3; i++) {
            p.mines[i] = Mine(0, i == 0 ? 6 : i == 1 ? 4 : 1, 1, 1);
        }
        _save(p, "register", 0);
    }

    function getState(address account) external view returns (Player memory p, uint256 timestamp) {
        p = players[account];
        timestamp = block.timestamp;
        if (p.exists) _advance(p);
    }

    function collectAll() external {
        Player memory p = _load();
        uint256 total;
        for (uint256 i; i < 3; i++) total += _collect(p, i);
        require(total > 0, "NOTHING_TO_COLLECT");
        _save(p, "collect", total);
    }

    function collectMine(uint8 id) external {
        require(id < 3, "INVALID_MINE");
        Player memory p = _load();
        uint256 total = _collect(p, id);
        require(total > 0, "NOTHING_TO_COLLECT");
        _save(p, "collect", total);
    }

    function craft(uint8 item, uint8 quantity) external {
        require(item >= 3 && item <= 7, "INVALID_RECIPE");
        require(quantity >= 1 && quantity <= 10, "INVALID_QUANTITY");
        Player memory p = _load();
        uint64 q = quantity;
        if (item == 3) { _pay(p, 0, 4*q); _pay(p, 1, 2*q); }
        else if (item == 4) { _pay(p, 3, 2*q); _pay(p, 0, q); }
        else if (item == 5) { _pay(p, 3, 3*q); _pay(p, 4, q); _pay(p, 2, q); }
        else if (item == 6) { _pay(p, 1, 3*q); _pay(p, 0, q); }
        else { _pay(p, 2, 2*q); _pay(p, 3, 2*q); _pay(p, 6, q); }
        p.inventory[item] += q;
        p.crafted += q;
        _save(p, "craft", item);
    }

    function setMachines(uint8 id, uint8 count) external {
        require(id < 3 && count <= 6, "INVALID_ASSIGNMENT");
        Player memory p = _load();
        p.mines[id].assigned = count;
        uint256 total;
        for (uint256 i; i < 3; i++) total += p.mines[i].assigned;
        require(total <= p.machines, "NO_FREE_MACHINE");
        _save(p, "assign", id);
    }

    function upgrade(uint8 id) external {
        require(id < 3, "INVALID_MINE");
        Player memory p = _load();
        uint64 level = p.mines[id].level;
        require(level < 5, "MAX_LEVEL");
        if (level == 1) { _pay(p, 0, 8); _pay(p, 1, 4); _pay(p, 3, 1); }
        else { _pay(p, 3, level); _pay(p, 4, level-1); _pay(p, 2, level); }
        p.mines[id].level++;
        p.upgrades++;
        _save(p, "upgrade", id);
    }

    function deliver(uint8 slot, uint64 expectedOrder) external {
        require(slot < 3, "INVALID_ORDER");
        Player memory p = _load();
        require(p.orders[slot] == expectedOrder, "STALE_ORDER");
        uint256 kind = expectedOrder % 8;
        uint64 reward;
        if (kind == 0) { _pay(p, 0, 6); _pay(p, 1, 2); reward = 18; }
        else if (kind == 1) { _pay(p, 3, 2); _pay(p, 1, 4); reward = 32; }
        else if (kind == 2) { _pay(p, 2, 3); _pay(p, 0, 4); reward = 26; }
        else if (kind == 3) { _pay(p, 4, 1); _pay(p, 3, 1); reward = 46; }
        else if (kind == 4) { _pay(p, 6, 2); _pay(p, 2, 1); reward = 38; }
        else if (kind == 5) { _pay(p, 7, 1); _pay(p, 0, 10); reward = 72; }
        else if (kind == 6) { _pay(p, 0, 18); _pay(p, 1, 12); reward = 36; }
        else { _pay(p, 3, 4); _pay(p, 2, 3); reward = 58; }
        p.score += reward;
        p.delivered++;
        p.orders[slot] = p.nextOrder++;
        _save(p, "deliver", reward);
    }

    function expand() external {
        Player memory p = _load();
        require(p.machines < 6, "MAX_MACHINES");
        _pay(p, 5, 1);
        p.machines++;
        _save(p, "expand", p.machines);
    }

    function boost() external {
        Player memory p = _load();
        require(p.boosts > 0, "NO_BOOSTS");
        p.boosts--;
        _produce(p, 60);
        _save(p, "boost", 60);
    }

    function _load() private view returns (Player memory p) {
        p = players[msg.sender];
        require(p.exists, "NOT_REGISTERED");
        _advance(p);
    }
    function _advance(Player memory p) private view {
        uint256 elapsed = block.timestamp - p.lastTick;
        if (elapsed > 4 hours) elapsed = 4 hours;
        _produce(p, elapsed);
        p.lastTick = uint64(block.timestamp);
    }
    function _produce(Player memory p, uint256 elapsed) private pure {
        for (uint256 i; i < 3; i++) {
            if (p.mines[i].assigned == 0) continue;
            uint256 period = i == 0 ? 6 : i == 1 ? 8 : 12;
            uint256 work = p.mines[i].work + elapsed;
            uint256 yield = (i == 0 ? 3 : i == 1 ? 2 : 1) + p.mines[i].level - 1;
            uint256 pending = p.mines[i].pending + (work / period) * yield * p.mines[i].assigned;
            uint256 cap = 32 + uint256(p.mines[i].level) * 8;
            p.mines[i].pending = uint64(pending > cap ? cap : pending);
            p.mines[i].work = uint64(work % period);
        }
    }
    function _collect(Player memory p, uint256 id) private pure returns (uint64 n) {
        n = p.mines[id].pending;
        p.inventory[id] += n;
        p.collected += n;
        p.mines[id].pending = 0;
    }
    function _pay(Player memory p, uint256 item, uint64 quantity) private pure {
        require(p.inventory[item] >= quantity, "INSUFFICIENT_MATERIALS");
        p.inventory[item] -= quantity;
    }
    function _save(Player memory p, bytes32 action, uint256 detail) private {
        players[msg.sender] = p;
        emit Activity(msg.sender, action, detail);
    }
}
