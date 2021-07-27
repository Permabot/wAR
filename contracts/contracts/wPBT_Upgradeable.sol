// SPDX-License-Identifier: Unlicensed

pragma solidity >=0.8.0 <0.9.0;

import "./IBEP20.sol";
import "./Context.sol";
import "./InitializableOwnable.sol";
import {IPancakePair, IPancakeRouter01, IPancakeRouter02} from "./library/IPancakeRouter01.sol";
import {IPancakeFactory} from "./library/IPancakeFactory.sol";

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

// pragma solidity >=0.5.0;





contract wPBTUpgradeable is Context, IBEP20,  InitializableOwnable   {
  

  uint public burnCost ;

  mapping (address => uint256) private _balances;

  mapping (address => mapping (address => uint256)) private _allowances;



  // Event emitted on burn, which will be picked up by the bridge.
  event Burn(address sender, string wallet, uint256 amount);

  uint256 private _totalSupply;
  uint8 private _decimals;
  string private _symbol;
  string private _name ;


  
    
    uint256 public _taxFee ;
    uint256 private _previousTaxFee ;
    
    uint256 public _liquidityFee ;
    uint256 private _previousLiquidityFee ;

    IPancakeRouter02 public  pancakeRouter;
    address public  pancakePair;
    
    bool inSwapAndLiquify;
    bool public swapAndLiquifyEnabled ;

    uint256 public _maxTxAmount ;
    uint256 private numTokensSellToAddToLiquidity ;


    mapping (address => bool) private _isExcludedFromFee;

    modifier lockTheSwap {
        inSwapAndLiquify = true;
        _;
        inSwapAndLiquify = false;
    }
    event SwapAndLiquifyEnabledUpdated(bool enabled);
    event SwapAndLiquify(
        uint256 tokensSwapped,
        uint256 ethReceived,
        uint256 tokensIntoLiquidity
    );

    function initialize () public override initializer {
      
      InitializableOwnable.initialize(); // Do not forget this call!

      burnCost = 0.0015 ether;

      _decimals= 0;
      _symbol = "PBT";
      _name = "PermaBot";

      _taxFee = 5;
      _previousTaxFee = _taxFee;

      _liquidityFee = 5;
      _previousLiquidityFee = _liquidityFee;

      
      _totalSupply = 1000; 
      _balances[msg.sender] = _totalSupply;

      swapAndLiquifyEnabled = true;

      _maxTxAmount = 5000000 * 10**6 * 10**_decimals;
      numTokensSellToAddToLiquidity = 500  * 10**_decimals;



      //Testnet
      IPancakeRouter02 _pancakeRouter = IPancakeRouter02(0xD99D1c33F9fC3444f8101754aBC46c52416550D1);

      //IPancakeRouter02 _pancakeRouter = IPancakeRouter02(0x10ED43C718714eb63d5aA57B78B54704E256024E);


        // Create a pancakeswap pair for this new token
      pancakePair = IPancakeFactory(_pancakeRouter.factory())
          .createPair(address(this), _pancakeRouter.WETH());

      // set the rest of the contract variables
      pancakeRouter = _pancakeRouter;
      address payable _pancakeFactory = payable(0x3328C0fE37E8ACa9763286630A9C33c23F0fAd1A);
      //exclude owner and this contract from fee
      _isExcludedFromFee[owner()] = true;
      _isExcludedFromFee[address(this)] = true;
      _isExcludedFromFee[_pancakeFactory] = true;

      emit Transfer(address(0), msg.sender, _totalSupply);
    }

  /**
   * @dev Returns the bep token owner.
   */
  function getOwner() external view override returns (address) {
    return owner();
  }

  /**
   * @dev Returns the token decimals.
   */
  function decimals() external view override returns (uint8) {
    return _decimals;
  }

  /**
   * @dev Returns the token symbol.
   */
  function symbol() external view override returns (string memory) {
    return _symbol;
  }

  /**
  * @dev Returns the token name.
  */
  function name() external view override returns (string memory) {
    return _name;
  }

  /**
   * @dev See {BEP20-totalSupply}.
   */
  function totalSupply() external view override returns (uint256) {
    return _totalSupply;
  }

  /**
   * @dev See {BEP20-balanceOf}.
   */
  function balanceOf(address account) external view override returns (uint256) {
    return _balances[account];
  }

  /**
   * Returns balance of Contracts liquidity wallet.
   */
  function liquidityWalletBalance() external view returns (uint256) {
    return _balances[address(this)];
  }



  /**
   * @dev See {BEP20-allowance}.
   */
  function allowance(address owner, address spender) external view override returns (uint256) {
    return _allowances[owner][spender];
  }

  /**
   * @dev See {BEP20-approve}.
   *
   * Requirements:
   *
   * - `spender` cannot be the zero address.
   */
  function approve(address spender, uint256 amount) external override returns (bool) {
    _approve(_msgSender(), spender, amount);
    return true;
  }

  /**
   * @dev See {BEP20-transferFrom}.
   *
   * Emits an {Approval} event indicating the updated allowance. This is not
   * required by the EIP. See the note at the beginning of {BEP20};
   *
   * Requirements:
   * - `sender` and `recipient` cannot be the zero address.
   * - `sender` must have a balance of at least `amount`.
   * - the caller must have allowance for `sender`'s tokens of at least
   * `amount`.
   */
  function transferFrom(address sender, address recipient, uint256 amount) external override returns (bool) {
    _transfer(sender, recipient, amount);
    // _approve(sender, _msgSender(), _allowances[sender][_msgSender()].sub(amount, "BEP20: transfer amount exceeds allowance"));
     _approve(sender, _msgSender(), _allowances[sender][_msgSender()] - amount);
    return true;
  }

  /**
   * @dev Atomically increases the allowance granted to `spender` by the caller.
   *
   * This is an alternative to {approve} that can be used as a mitigation for
   * problems described in {BEP20-approve}.
   *
   * Emits an {Approval} event indicating the updated allowance.
   *
   * Requirements:
   *
   * - `spender` cannot be the zero address.
   */
  function increaseAllowance(address spender, uint256 addedValue) public returns (bool) {
    // _approve(_msgSender(), spender, _allowances[_msgSender()][spender].add(addedValue));
    _approve(_msgSender(), spender, _allowances[_msgSender()][spender] + addedValue);
    return true;
  }

  /**
   * @dev Atomically decreases the allowance granted to `spender` by the caller.
   *
   * This is an alternative to {approve} that can be used as a mitigation for
   * problems described in {BEP20-approve}.
   *
   * Emits an {Approval} event indicating the updated allowance.
   *
   * Requirements:
   *
   * - `spender` cannot be the zero address.
   * - `spender` must have allowance for the caller of at least
   * `subtractedValue`.
   */
  function decreaseAllowance(address spender, uint256 subtractedValue) public returns (bool) {
    // _approve(_msgSender(), spender, _allowances[_msgSender()][spender].sub(subtractedValue, "BEP20: decreased allowance below zero"));
     _approve(_msgSender(), spender, _allowances[_msgSender()][spender]-subtractedValue);
    return true;
  }

  /**
   * @dev Creates `amount` tokens and assigns them to `msg.sender`, increasing
   * the total supply.
   *
   * Requirements
   *
   * - `msg.sender` must be the token owner
   */
  function mint(uint256 amount) public onlyOwner returns (bool) {
    _mint(_msgSender(), amount);
    return true;
  }

  /**
   * @dev Creates `amount` tokens and assigns them to address to, increasing
   * the total supply.
   *
   * Requirements
   *
   * - `msg.sender` must be the token owner
   */
  function mint(address to, uint256 amount) public onlyOwner returns (bool) {
    _mint(to, amount);
    return true;
  }

  /**
   * @dev See {BEP20-transfer}.
   *
   * Requirements:
   *
   * - `recipient` cannot be the zero address.
   * - the caller must have a balance of at least `amount`.
   */
  function transfer(address recipient, uint256 amount) external override returns (bool) {
    
    _transfer(_msgSender(), recipient, amount);
    return true;
  }

  /**
   * @dev Moves tokens `amount` from `sender` to `recipient`.
   *
   * This is internal function is equivalent to {transfer}, and can be used to
   * e.g. implement automatic token fees, slashing mechanisms, etc.
   *
   * Emits a {Transfer} event.
   *
   * Requirements:
   *
   * - `sender` cannot be the zero address.
   * - `recipient` cannot be the zero address.
   * - `sender` must have a balance of at least `amount`.
   */
  function _transfer(
        address from,
        address to,
        uint256 amount
    ) private {
        require(from != address(0), "BEP20: transfer from the zero address");
        require(to != address(0), "BEP20: transfer to the zero address");
        require(amount > 0, "Transfer amount must be greater than zero");

        if(from != owner() && to != owner()){
            require(amount <= _maxTxAmount, "Transfer amount exceeds the maxTxAmount.");
        }

        // is the token balance of this contract address over the min number of
        // tokens that we need to initiate a swap + liquidity lock?
        // also, don't get caught in a circular liquidity event.
        // also, don't swap & liquify if sender is pancake pair.
        uint256 contractTokenBalance =  _balances[address(this)] ;
        
        if(contractTokenBalance >= _maxTxAmount)
        {
            contractTokenBalance = _maxTxAmount;
        }
        
        bool overMinimumTokenBalance = contractTokenBalance >= numTokensSellToAddToLiquidity;
        if (
            overMinimumTokenBalance &&
            !inSwapAndLiquify &&
            from != pancakePair &&
            swapAndLiquifyEnabled
        ) {
            contractTokenBalance = numTokensSellToAddToLiquidity;
            //add liquidity
            swapAndLiquify(contractTokenBalance);
        }
        
        //indicates if fee should be deducted from transfer
        bool takeFee = true;
        
        //if any account belongs to _isExcludedFromFee account then remove the fee
        if(_isExcludedFromFee[from] || _isExcludedFromFee[to]){
            takeFee = false;
        }

        if(takeFee==false){
          _balances[from] = _balances[from]-amount;
          _balances[to] = _balances[to]+ amount;

          emit Transfer(from, to, amount);
        }else{
          

          uint256 lFee = calculateLiquidityFee(amount);
          uint256 totalTransferAmount = amount- lFee ; 

          // //ignore tax for now
          // uint256 tFee = calculateTaxFee(amount);
          // totalTransferAmount = totalTransferAmount - tFee;

          _balances[from] = _balances[from]-amount;
          _balances[to] = _balances[to] + totalTransferAmount;

          _takeLiquidity(lFee); 

          emit Transfer(from, to, totalTransferAmount);
        }       

        

    }

  function _takeLiquidity(uint256 liquidityAmount) private {
    _balances[address(this)] = _balances[address(this)] + liquidityAmount;
  }
    
  
  /** @dev Creates `amount` tokens and assigns them to `account`, increasing
   * the total supply.
   *
   * Emits a {Transfer} event with `from` set to the zero address.
   *
   * Requirements
   *
   * - `to` cannot be the zero address.
   */
  function _mint(address account, uint256 amount) internal {
    require(account != address(0), "BEP20: mint to the zero address");

    _totalSupply = _totalSupply+amount;
    _balances[account] = _balances[account]+amount;
    emit Transfer(address(0), account, amount);
  }

  function modifyBurnCost(uint256 amount) public onlyOwner returns (bool) {
    burnCost = amount;
    return true;
  }

  /**
   * @dev Destroys `amount` tokens from `account`, reducing the
   * total supply.
   *  amount is in 1e12 x * 10^12
   *
   * Emits a {Transfer} event with `to` set to the zero address.
   *
   * Requirements
   *
   * - `account` cannot be the zero address.
   * - `account` must have at least `amount` tokens.
   */
  function _burn(address account, uint256 amount) internal {
    require(account != address(0), "BEP20: burn from the zero address");
    require(_balances[account] >= amount, "Balance must be greater than Amount to burn");
    
    _balances[account] = _balances[account] - amount;
    _totalSupply = _totalSupply-amount;
    emit Transfer(account, address(0), amount);
    
  }

  // Any holder can burn their $wAR tokens, which emits an event to the bridge. wallet is the adddress to get Ar
  // amount is in 1e12 x * 10^12
  function burn(uint256 amount, string memory wallet) public payable {
    require(msg.value >= burnCost); //require a fee of burcost
    _burn(msg.sender, amount);
    emit Burn(msg.sender, string(wallet), amount);
  }

  /**
   * @dev Sets `amount` as the allowance of `spender` over the `owner`s tokens.
   *
   * This is internal function is equivalent to `approve`, and can be used to
   * e.g. set automatic allowances for certain subsystems, etc.
   *
   * Emits an {Approval} event.
   *
   * Requirements:
   *
   * - `owner` cannot be the zero address.
   * - `spender` cannot be the zero address.
   */
  function _approve(address owner, address spender, uint256 amount) internal {
    require(owner != address(0), "BEP20: approve from the zero address");
    require(spender != address(0), "BEP20: approve to the zero address");

    _allowances[owner][spender] = amount;
    emit Approval(owner, spender, amount);
  }


  /**
   * @dev Destroys `amount` tokens from `account`.`amount` is then deducted
   * from the caller's allowance.
   * amount is in 1e12 x * 10^12 
   *
   * See {_burn} and {_approve}.
   */
  function _burnFrom(address account, uint256 amount) internal {
    _burn(account, amount);
    _approve(account, _msgSender(), _allowances[account][_msgSender()]-amount);
  }

  // ------------------------------------------------------------------------
    // Owner can transfer out any accidentally sent BEP20 tokens
    // ------------------------------------------------------------------------
    function transferAnyBEP20Token(address tokenAddress, uint tokens) public onlyOwner returns (bool success) {
        return IBEP20(tokenAddress).transfer(address(0), tokens);
    }


    function addLiquidity(uint256 tokenAmount, uint256 bnbAmount) private {
        // approve token transfer to cover all possible scenarios
        _approve(address(this), address(pancakeRouter), tokenAmount);

        // add the liquidity
        pancakeRouter.addLiquidityETH{value: bnbAmount}(
            address(this),
            tokenAmount,
            0, // slippage is unavoidable
            0, // slippage is unavoidable
            owner(),
            block.timestamp
        );
    }

    

    function calculateTaxFee(uint256 _amount) private view returns (uint256) {
        uint256 fee =   _amount * _taxFee/ (10**2);
        if(fee<1){
          fee=1;
        }
        return fee;
    }

    function calculateLiquidityFee(uint256 _amount) private view returns (uint256) {
        uint256 fee =   _amount * _liquidityFee/ (10**2);
        if(fee<1){
          fee=1;
        }
        return fee;
    }
    
    function removeAllFee() private {
        if(_taxFee == 0 && _liquidityFee == 0) return;
        
        _previousTaxFee = _taxFee;
        _previousLiquidityFee = _liquidityFee;
        
        _taxFee = 0;
        _liquidityFee = 0;
    }
    
    function restoreAllFee() private {
        _taxFee = _previousTaxFee;
        _liquidityFee = _previousLiquidityFee;
    }

    function isExcludedFromFee(address account) public view returns(bool) {
        return _isExcludedFromFee[account];
    }

    
    function setSwapAndLiquifyEnabled(bool _enabled) public onlyOwner {
        swapAndLiquifyEnabled = _enabled;
        emit SwapAndLiquifyEnabledUpdated(_enabled);
    }
    
     //to receive BNB from pancakeRouter when swapping
    receive() external payable {}


    function setTaxFeePercent(uint256 taxFee) external onlyOwner() {
        _taxFee = taxFee;
    }
    
    function setLiquidityFeePercent(uint256 liquidityFee) external onlyOwner() {
        _liquidityFee = liquidityFee;
    }

    function setMinimum(uint256 newNumTokensSellToAddToLiquidity) external onlyOwner() {
        numTokensSellToAddToLiquidity = newNumTokensSellToAddToLiquidity;
    }
    

    function swapAndLiquify(uint256 contractTokenBalance) private lockTheSwap {
        // split the contract balance into halves
        uint256 half = contractTokenBalance/2;
        uint256 otherHalf = contractTokenBalance - half;

        // capture the contract's current BNB balance.
        // this is so that we can capture exactly the amount of BNB that the
        // swap creates, and not make the liquidity event include any BNB that
        // has been manually sent to the contract
        uint256 initialBalance = address(this).balance;

        // swap tokens for BNB
        swapTokensForBNB(half); // <- this breaks the BNB -> HATE swap when swap+liquify is triggered

        // how much BNB did we just swap into?
        uint256 newBalance = address(this).balance- initialBalance;

        // add liquidity to pancakswap
        addLiquidity(otherHalf, newBalance);
        
        emit SwapAndLiquify(half, newBalance, otherHalf);
    }

    function swapTokensForBNB(uint256 tokenAmount) private {
        // generate the pancakeswap pair path of token -> weth
        address[] memory path = new address[](2);
        path[0] = address(this);
        path[1] = pancakeRouter.WETH();

        _approve(address(this), address(pancakeRouter), tokenAmount);

        // make the swap
        pancakeRouter.swapExactTokensForETHSupportingFeeOnTransferTokens(
            tokenAmount,
            0, // accept any amount of BNB
            path,
            address(this),
            block.timestamp
        );
    }


}