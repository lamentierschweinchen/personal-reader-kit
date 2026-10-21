import test from 'node:test';
import assert from 'node:assert/strict';
import {newState,validateState} from '../site/core.mjs';
test('source-character places survive state validation; old ratio-only places remain readable',()=>{
  const state=newState(),position={sectionId:'chapter',blockId:'paragraph',ratio:.5,revision:'a'.repeat(64),offset:812,inset:-4};
  state.positions.book=position;assert.deepEqual(validateState(state).positions.book,position);
  delete position.offset;delete position.inset;assert.deepEqual(validateState(state).positions.book,position);
});
test('invalid character places cannot enter a recovery backup',()=>{
  for(const change of [{offset:-1},{offset:200001},{offset:1.2},{inset:Infinity},{inset:501}]){
    const state=newState();state.positions.book={sectionId:'chapter',blockId:'paragraph',ratio:.5,revision:'a'.repeat(64),...change};assert.throws(()=>validateState(state),/reading position/);
  }
});
