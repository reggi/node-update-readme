import {expect} from 'chai';
import {example} from './mod';

describe('example', () => {
  it('should test example', () => {
    expect(example()).to.equal(true);
  });
});
