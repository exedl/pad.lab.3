//const app = require('../src/server');
//request = require('supertest');
let http = require('sync-request');

describe('API Test',()=>{
    it('Sample test', (done) => {
        expect('ok').toBe('ok');

        //app.close();

        done();
    });
});
