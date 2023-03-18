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
    event Failed(bytes error);

    constructor(bytes memory solutionRuntime, uint256 salt) payable {
        PuzzleBoxFactory factory = new PuzzleBoxFactory();
        PuzzleBox puzzle = factory.createPuzzleBox{value: msg.value}();
        ISolution sol = ISolution(address(
            new SolutionContainer{salt: bytes32(salt)}(solutionRuntime)
        ));
        emit Start(puzzle);
        bytes4 selector = ISolution.solve.selector;
        uint256 gasUsed;
        bool success;
        bytes memory err;
        assembly {
            mstore(0x00, selector)
            mstore(0x04, puzzle)
            gasUsed := gas()
            success := call(gas(), sol, 0, 0x00, 0x24, 0x00, 0x00)
            gasUsed := sub(gasUsed, gas())
            if iszero(success) {
                err := mload(0x40)
                mstore(err, returndatasize())
                returndatacopy(add(err, 0x20), 0x00, returndatasize())
                mstore(0x40, add(err, add(returndatasize(), 0x20)))
            }
        }
        gasUsed = gasUsed > 605 ? gasUsed - 605: 0;
        if (!success) {
            emit Failed(err);
        } else {
            emit Complete(gasUsed);
        }
    }
}
