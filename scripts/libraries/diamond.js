/* global ethers */

const FacetCutAction = { Add: 0, Replace: 1, Remove: 2 };

// getSelectors returns the function selectors from the ABI of a contract
function getSelectors (contract) {
  const signatures = Object.keys(contract.interface.functions);
  const selectors = signatures.reduce((acc, val) => {
    if (val !== 'init(bytes)') { // Exclude init function from selectors
      acc.push(contract.interface.getSighash(val));
    }
    return acc;
  }, []);
  return selectors;
}

// getSelector returns the function selector from the ABI of a function signature
function getSelector (func) {
  const fragment = ethers.FunctionFragment.from(func);
  return fragment.selector;
}

exports.getSelectors = getSelectors;
exports.getSelector = getSelector;
exports.FacetCutAction = FacetCutAction;