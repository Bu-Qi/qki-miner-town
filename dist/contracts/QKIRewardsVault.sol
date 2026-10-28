// SPDX-License-Identifier: MIT
pragma solidity 0.8.38;

import "./QKIMinerTown.sol";

/// @notice Revenue-funded, seven-day game seasons. Cosmetic purchase is never required to earn.
/// @dev No deposit principal, APR, staking shares or administrator-controlled player withdrawals.
contract QKIRewardsVault {
    uint256 public constant SEASON = 7 days;
    uint256 public constant MIN_AGE = 1 days;
    uint256 public constant MIN_ORDERS = 10;
    uint256 public constant WEIGHT_CAP = 1000;
    QKIMinerTown public game;
    address public treasury;
    uint256 public skinPrice;
    uint64 public genesis;
    uint256 public projectAccrued;
    uint256 public accountedBalance;
    uint256 private entered = 1;

    struct Entry {
        bool enrolled;
        bool claimed;
        uint64 baseline;
        uint64 points;
        uint64 joinIndex;
        uint16 weight;
    }
    struct Season {
        uint256 prizeBudget;
        uint256 dividendBudget;
        uint256 totalWeight;
        uint256 prizeRemaining;
        uint256 dividendRemaining;
        uint256 weightRemaining;
        uint64 participants;
        bool settled;
        address[3] leaders;
        uint64[3] topPoints;
    }
    mapping(uint256 => Season) private seasons;
    mapping(uint256 => mapping(address => Entry)) private entries;
    mapping(uint256 => mapping(address => uint256)) public prizeAwards;
    mapping(address => bool) public ownsSkin;

    event Funded(uint256 indexed epoch, address indexed sender, uint256 prize, uint256 dividend, uint256 project);
    event SkinPurchased(address indexed player, uint256 price);
    event Enrolled(uint256 indexed epoch, address indexed player, uint64 baseline);
    event Synced(uint256 indexed epoch, address indexed player, uint64 points, uint16 weight);
    event Settled(uint256 indexed epoch, uint256 prizesAllocated, uint256 dividends, uint256 carried);
    event Claimed(uint256 indexed epoch, address indexed player, address recipient, uint256 prize, uint256 dividend);
    event ProjectWithdrawn(address indexed recipient, uint256 amount);

    modifier nonReentrant() {
        require(entered == 1, "REENTRANCY");
        entered = 2;
        _;
        entered = 1;
    }

    constructor(address game_, uint256 skinPrice_) {
        require(game_ != address(0) && skinPrice_ > 0, "INVALID_CONFIG");
        game = QKIMinerTown(game_);
        require(game.gameId() == keccak256("QKI_MINER_TOWN_V1"), "INVALID_GAME");
        treasury = msg.sender;
        skinPrice = skinPrice_;
        genesis = uint64(block.timestamp);
    }

    function vaultId() external pure returns (bytes32) { return keccak256("QKI_REWARDS_VAULT_V1"); }
    function currentEpoch() public view returns (uint256) { return (block.timestamp - genesis) / SEASON; }
    function epochEnd(uint256 e) public view returns (uint256) { return uint256(genesis) + (e + 1) * SEASON; }

    function _epoch(uint256 expected) private view returns (uint256 e) {
        e = currentEpoch();
        require(e == expected, "EPOCH_CHANGED");
    }
    function sponsor(uint256 expectedEpoch) external payable nonReentrant { _sponsor(expectedEpoch); }
    receive() external payable nonReentrant { _sponsor(currentEpoch()); }
    function _sponsor(uint256 expectedEpoch) private {
        require(msg.value > 0, "ZERO_AMOUNT");
        uint256 e = _epoch(expectedEpoch);
        seasons[e].prizeBudget += msg.value;
        accountedBalance += msg.value;
        emit Funded(e, msg.sender, msg.value, 0, 0);
    }

    function buySkin(uint256 expectedEpoch) external payable nonReentrant {
        uint256 e = _epoch(expectedEpoch);
        require(!ownsSkin[msg.sender], "SKIN_ALREADY_OWNED");
        require(msg.value == skinPrice, "WRONG_PRICE");
        ownsSkin[msg.sender] = true;
        uint256 prize = msg.value * 60 / 100;
        uint256 dividend = msg.value * 20 / 100;
        uint256 project = msg.value - prize - dividend;
        seasons[e].prizeBudget += prize;
        seasons[e].dividendBudget += dividend;
        projectAccrued += project;
        accountedBalance += msg.value;
        emit Funded(e, msg.sender, prize, dividend, project);
        emit SkinPurchased(msg.sender, msg.value);
    }

    function enroll(uint256 expectedEpoch) external nonReentrant {
        uint256 e = _epoch(expectedEpoch);
        Entry storage a = entries[e][msg.sender];
        require(!a.enrolled, "ALREADY_ENROLLED");
        (QKIMinerTown.Player memory player,) = game.getState(msg.sender);
        require(player.exists && block.timestamp >= uint256(player.created) + MIN_AGE && player.delivered >= MIN_ORDERS, "NOT_ELIGIBLE");
        a.enrolled = true;
        a.baseline = player.score;
        a.joinIndex = ++seasons[e].participants;
        emit Enrolled(e, msg.sender, player.score);
    }

    /// @notice Only score earned after enrolling and synced before the deadline is counted.
    function sync(uint256 expectedEpoch) external nonReentrant {
        uint256 e = _epoch(expectedEpoch);
        Entry storage a = entries[e][msg.sender];
        require(a.enrolled, "ENROLL_FIRST");
        (QKIMinerTown.Player memory player,) = game.getState(msg.sender);
        require(player.score >= a.baseline, "SCORE_DECREASED");
        uint64 points = player.score - a.baseline;
        require(points > a.points, "NO_NEW_POINTS");
        uint16 weight = uint16(points > WEIGHT_CAP ? WEIGHT_CAP : points);
        seasons[e].totalWeight += uint256(weight) - a.weight;
        a.points = points;
        a.weight = weight;
        _rank(e, msg.sender);
        emit Synced(e, msg.sender, points, weight);
    }

    function _ahead(uint256 e, address a, address b) private view returns (bool) {
        if (a == address(0)) return false;
        if (b == address(0)) return true;
        Entry storage aa = entries[e][a];
        Entry storage bb = entries[e][b];
        return aa.points > bb.points || (aa.points == bb.points && aa.joinIndex < bb.joinIndex);
    }
    function _rank(uint256 e, address player) private {
        Season storage p = seasons[e];
        address[4] memory candidates = [p.leaders[0], p.leaders[1], p.leaders[2], player];
        for (uint256 i; i < 3; i++) if (candidates[i] == player) candidates[3] = address(0);
        for (uint256 i; i < 3; i++) {
            for (uint256 j = i + 1; j < 4; j++) if (_ahead(e, candidates[j], candidates[i])) (candidates[i], candidates[j]) = (candidates[j], candidates[i]);
            p.leaders[i] = candidates[i];
            p.topPoints[i] = entries[e][candidates[i]].points;
        }
    }

    function settle(uint256 e) external nonReentrant { _settle(e); }
    function _settle(uint256 e) private {
        require(block.timestamp >= epochEnd(e), "SEASON_NOT_ENDED");
        Season storage p = seasons[e];
        require(!p.settled, "ALREADY_SETTLED");
        p.settled = true;
        uint256 allocated;
        for (uint256 i; i < 3; i++) {
            if (p.leaders[i] == address(0)) continue;
            uint256 award = p.prizeBudget * (i == 0 ? 50 : i == 1 ? 30 : 20) / 100;
            prizeAwards[e][p.leaders[i]] = award;
            allocated += award;
        }
        p.prizeRemaining = allocated;
        p.dividendRemaining = p.totalWeight == 0 ? 0 : p.dividendBudget;
        p.weightRemaining = p.totalWeight;
        uint256 carried = p.prizeBudget - allocated + (p.totalWeight == 0 ? p.dividendBudget : 0);
        if (carried > 0) _carry(e, carried);
        emit Settled(e, allocated, p.dividendRemaining, carried);
    }
    function _carry(uint256 from, uint256 amount) private {
        uint256 destination = currentEpoch();
        if (destination <= from) destination = from + 1;
        seasons[destination].prizeBudget += amount;
    }

    function claimable(uint256 e, address account) public view returns (uint256 prize, uint256 dividend) {
        Season storage p = seasons[e];
        Entry storage a = entries[e][account];
        if (a.claimed || block.timestamp < epochEnd(e)) return (0, 0);
        if (p.settled) prize = prizeAwards[e][account];
        else for (uint256 i; i < 3; i++) if (p.leaders[i] == account && account != address(0)) prize = p.prizeBudget * (i == 0 ? 50 : i == 1 ? 30 : 20) / 100;
        if (p.totalWeight > 0) dividend = p.dividendBudget * a.weight / p.totalWeight;
    }
    /// @notice Players pull their own rewards. Rejected recipients only revert their own claim.
    function claim(uint256 e, address payable recipient) external nonReentrant {
        if (!seasons[e].settled) _settle(e);
        Entry storage a = entries[e][msg.sender];
        require(!a.claimed, "ALREADY_CLAIMED");
        (uint256 prize, uint256 dividend) = claimable(e, msg.sender);
        require(prize + dividend > 0 || a.weight > 0, "NOTHING_TO_CLAIM");
        a.claimed = true;
        Season storage p = seasons[e];
        p.prizeRemaining -= prize;
        p.dividendRemaining -= dividend;
        p.weightRemaining -= a.weight;
        if (p.weightRemaining == 0 && p.dividendRemaining > 0) {
            uint256 dust = p.dividendRemaining;
            p.dividendRemaining = 0;
            _carry(e, dust);
        }
        if (prize + dividend > 0) _pay(recipient, prize + dividend);
        emit Claimed(e, msg.sender, recipient, prize, dividend);
    }
    function withdrawProject(address payable recipient) external nonReentrant {
        require(msg.sender == treasury, "TREASURY_ONLY");
        uint256 amount = projectAccrued;
        require(amount > 0, "NOTHING_TO_CLAIM");
        projectAccrued = 0;
        _pay(recipient, amount);
        emit ProjectWithdrawn(recipient, amount);
    }
    function _pay(address payable recipient, uint256 amount) private {
        require(recipient != address(0) && recipient != address(this), "INVALID_RECIPIENT");
        accountedBalance -= amount;
        (bool ok,) = recipient.call{value: amount}("");
        require(ok, "TRANSFER_FAILED");
    }

    function config() external view returns (address gameAddress, address operator, uint256 price, uint64 start, uint256 operatorFunds, uint256 accounted, uint256 balance, uint256 timestamp) {
        return (address(game), treasury, skinPrice, genesis, projectAccrued, accountedBalance, address(this).balance, block.timestamp);
    }
    function overview(uint256 e, address account) external view returns (Season memory pool, Entry memory entry, bool skinOwned, uint256 prize, uint256 dividend, uint64 score, uint64 created, uint64 delivered, uint256 timestamp) {
        pool = seasons[e];
        entry = entries[e][account];
        skinOwned = ownsSkin[account];
        (prize, dividend) = claimable(e, account);
        (QKIMinerTown.Player memory player,) = game.getState(account);
        return (pool, entry, skinOwned, prize, dividend, player.score, player.created, player.delivered, block.timestamp);
    }
}
