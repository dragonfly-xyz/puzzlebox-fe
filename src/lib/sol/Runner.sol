pragma solidity ^0.8;

import "./PuzzleBox.sol";

interface ISolution {
    function solve(PuzzleBox puzzle) external;
}

contract SolutionContainer {
    constructor(bytes memory solutionRuntime) {
        assembly {
            return(add(solutionRuntime, 0x20), mload(solutionRuntime))
        }
    }
}

contract Runner {
    event Start(PuzzleBox puzzle);
    event Complete(uint256 gasUsed);

    constructor(bytes memory solutionRuntime, uint256 salt) payable {
        PuzzleBoxFactory factory = new PuzzleBoxFactory();
        PuzzleBox puzzle = factory.createPuzzleBox{value: msg.value}();
        ISolution sol = ISolution(address(
            new SolutionContainer{salt: bytes32(salt)}(solutionRuntime)
        ));
        emit Start(puzzle);
        bytes4 selector = ISolution.solve.selector;
        uint256 gasUsed;
        assembly {
            mstore(0x00, selector)
            mstore(0x04, puzzle)
            gasUsed := gas()
            let s := call(gas(), sol, 0, 0x00, 0x24, 0x00, 0x00)
            if iszero(s) {
                returndatacopy(0x00, 0x00, returndatasize())
                revert(0x00, returndatasize())
            }
            gasUsed := sub(gasUsed, gas())
        }
        gasUsed = gasUsed > 605 ? gasUsed - 605: 0;
        emit Complete(gasUsed);
    }
}
