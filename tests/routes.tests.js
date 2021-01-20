const axios = require('axios');
const chai = require('chai');
const mockedEnv = require('mocked-env');
const sinon = require('sinon');
const routes = require('../src/routes');

require('../src/logger');

const expect = chai.expect;

describe('routes', function() {
    let axiosStub;
    let originalEnv;

    before(() => {
        originalEnv = mockedEnv({
            UVS_HOMESERVER_URL: 'http://127.0.0.1',
        });
    });

    after(() => {
        originalEnv();
    });

    afterEach(function() {
        axiosStub.restore();
    });

    describe('getHealth', function() {
        it('thumbs up', function() {
            axiosStub = sinon.spy(axios, 'get');
            let req = {};
            let res = {
                send: sinon.spy(),
            };
            routes.getHealth(req, res);

            expect(res.send.calledOnce).to.be.true;
            expect(res.send.firstCall.args[0]).to.equal('👍');
        });
    });

    describe('postVerifyUser', function() {
        it('calls S2S API OpenID userinfo endpoint', async function() {
            axiosStub = sinon.spy(axios, 'get');
            let req = {
                body: {
                    token: 'foobar',
                },
            };
            let res = {
                send: sinon.spy(),
            };
            await routes.postVerifyUser(req, res);
            expect(res.send.calledOnce).to.be.true;
            expect(axiosStub.calledOnce).to.be.true;
            expect(axiosStub.firstCall.args[0]).to.include(
                '/_matrix/federation/v1/openid/userinfo?access_token=foobar',
            );
        });

        it('returns false on invalid token', async function () {
            axiosStub = sinon.stub(axios, 'get').throws();
            let req = {
                body: {
                    token: 'foobar',
                },
            };
            let res = {
                send: sinon.spy(),
            };
            await routes.postVerifyUser(req, res);

            expect(res.send.firstCall.args[0]).to.deep.equal({results: {user: false}, user_id: null});
            expect(res.send.calledOnce).to.be.true;
        });

        it('returns true and user ID on valid token', async function () {
            axiosStub = sinon.stub(axios, 'get').returns({data: {sub: '@user:synapse.local'}});
            let req = {
                body: {
                    token: 'foobar',
                },
            };
            let res = {
                send: sinon.spy(),
            };
            await routes.postVerifyUser(req, res);

            expect(res.send.firstCall.args[0]).to.deep.equal({
                results: {user: true}, user_id: '@user:synapse.local',
            });
            expect(res.send.calledOnce).to.be.true;
        });

        describe('multiple homeserver mode', () => {
            let originalEnv;

            before(() => {
                originalEnv = mockedEnv({
                    UVS_OPENID_VERIFY_ANY_HOMESERVER: 'true',
                });
            });

            after(() => {
                originalEnv();
            });

            it('verify user requires a matrix_server_name', async function() {
                axiosStub = sinon.spy(axios, 'get');
                let req = {
                    body: {
                        token: 'foobar',
                    },
                };
                let res = {
                    send: sinon.spy(),
                    status: sinon.spy(),
                };
                await routes.postVerifyUser(req, res);
                expect(res.send.calledOnce).to.be.true;
                expect(res.status.calledOnce).to.be.true;
                expect(res.status.firstCall.args[0]).to.equal(400);
                expect(axiosStub.calledOnce).to.be.false;
            });
        });

        describe('authentication', () => {
            let originalEnv;

            before(() => {
                originalEnv = mockedEnv({
                    UVS_AUTH_TOKEN: 'token',
                });
            });

            after(() => {
                originalEnv();
            });

            it('rejects if no token given', async function() {
                axiosStub = sinon.spy(axios, 'get');
                let req = {
                    body: {
                        token: 'foobar',
                    },
                    header: () => {},
                };
                let res = {
                    send: sinon.spy(),
                    status: sinon.spy(),
                };
                await routes.postVerifyUser(req, res);
                expect(res.send.calledOnce).to.be.true;
                expect(res.status.calledOnce).to.be.true;
                expect(res.status.firstCall.args[0]).to.equal(403);
                expect(axiosStub.calledOnce).to.be.false;
            });

            it('rejects if wrong token given', async function() {
                axiosStub = sinon.spy(axios, 'get');
                let req = {
                    body: {
                        token: 'foobar',
                    },
                    header: (header) => {
                        return header === 'Authorization' ? 'Bearer wrongtoken' : '';
                    },
                };
                let res = {
                    send: sinon.spy(),
                    status: sinon.spy(),
                };
                await routes.postVerifyUser(req, res);
                expect(res.send.calledOnce).to.be.true;
                expect(res.status.calledOnce).to.be.true;
                expect(res.status.firstCall.args[0]).to.equal(403);
                expect(axiosStub.calledOnce).to.be.false;
            });

            it('succeeds if right token given', async function() {
                axiosStub = sinon.spy(axios, 'get');
                let req = {
                    body: {
                        token: 'foobar',
                    },
                    header: (header) => {
                        return header === 'Authorization' ? 'Bearer token' : '';
                    },
                };
                let res = {
                    send: sinon.spy(),
                    status: sinon.spy(),
                };
                await routes.postVerifyUser(req, res);
                expect(res.send.calledOnce).to.be.true;
                expect(res.status.calledOnce).to.be.false;
                expect(axiosStub.calledOnce).to.be.true;
            });
        });
    });

    describe('postVerifyUserInRoom', function() {
        it('calls Synapse admin API to verify room membership', async function() {
            axiosStub = sinon.stub(axios, 'get').returns({data: {sub: '@user:synapse.local'}});
            let req = {
                body: {
                    room_id: '!barfoo:synapse.local',
                    token: 'foobar',
                },
            };
            let res = {
                send: sinon.spy(),
            };
            await routes.postVerifyUserInRoom(req, res);

            expect(res.send.calledOnce).to.be.true;
            expect(axiosStub.calledTwice).to.be.true;
            expect(axiosStub.secondCall.args[0]).to.include(
                '/_synapse/admin/v1/rooms/!barfoo:synapse.local/members',
            );
        });

        it('returns false on invalid token', async function() {
            axiosStub = sinon.stub(axios, 'get').onFirstCall().returns({data: {sub: '@user:synapse.local'}});
            axiosStub.onSecondCall().returns({data: {members: []}});
            let req = {
                body: {
                    room_id: '!barfoo:synapse.local',
                    token: 'foobar',
                },
            };
            let res = {
                send: sinon.spy(),
            };
            await routes.postVerifyUserInRoom(req, res);

            expect(res.send.firstCall.args[0]).to.deep.equal({
                results: {user: true, room_membership: false}, user_id: '@user:synapse.local',
            });
            expect(res.send.calledOnce).to.be.true;
        });

        it('returns true and user ID on valid token', async function() {
            axiosStub = sinon.stub(axios, 'get').onFirstCall().returns({data: {sub: '@user:synapse.local'}});
            axiosStub.onSecondCall().returns({data: {members: ['@user:synapse.local']}});
            let req = {
                body: {
                    room_id: '!barfoo:synapse.local',
                    token: 'foobar',
                },
            };
            let res = {
                send: sinon.spy(),
            };
            await routes.postVerifyUserInRoom(req, res);

            expect(res.send.firstCall.args[0]).to.deep.equal({
                results: {user: true, room_membership: true}, user_id: '@user:synapse.local',
            });
            expect(res.send.calledOnce).to.be.true;
        });

        describe('multiple homeserver mode', () => {
            let originalEnv;

            before(() => {
                originalEnv = mockedEnv({
                    UVS_OPENID_VERIFY_ANY_HOMESERVER: 'true',
                });
            });

            after(() => {
                originalEnv();
            });

            it('verify user in room requires a matrix_server_name', async function() {
                axiosStub = sinon.spy(axios, 'get');
                let req = {
                    body: {
                        room_id: '!foobar:domain.tld',
                        token: 'foobar',
                    },
                };
                let res = {
                    send: sinon.spy(),
                    status: sinon.spy(),
                };
                await routes.postVerifyUserInRoom(req, res);
                expect(res.send.calledOnce).to.be.true;
                expect(res.status.calledOnce).to.be.true;
                expect(res.status.firstCall.args[0]).to.equal(400);
                expect(axiosStub.calledOnce).to.be.false;
            });
        });

        describe('authentication', () => {
            let originalEnv;

            before(() => {
                originalEnv = mockedEnv({
                    UVS_AUTH_TOKEN: 'token',
                });
            });

            after(() => {
                originalEnv();
            });

            it('rejects if no token given', async function() {
                axiosStub = sinon.spy(axios, 'get');
                let req = {
                    body: {
                        room_id: '!foobar:domain.tld',
                        token: 'foobar',
                    },
                    header: () => {},
                };
                let res = {
                    send: sinon.spy(),
                    status: sinon.spy(),
                };
                await routes.postVerifyUserInRoom(req, res);
                expect(res.send.calledOnce).to.be.true;
                expect(res.status.calledOnce).to.be.true;
                expect(res.status.firstCall.args[0]).to.equal(403);
                expect(axiosStub.calledOnce).to.be.false;
            });

            it('rejects if wrong token given', async function() {
                axiosStub = sinon.spy(axios, 'get');
                let req = {
                    body: {
                        room_id: '!foobar:domain.tld',
                        token: 'foobar',
                    },
                    header: (header) => {
                        return header === 'Authorization' ? 'Bearer wrongtoken' : '';
                    },
                };
                let res = {
                    send: sinon.spy(),
                    status: sinon.spy(),
                };
                await routes.postVerifyUserInRoom(req, res);
                expect(res.send.calledOnce).to.be.true;
                expect(res.status.calledOnce).to.be.true;
                expect(res.status.firstCall.args[0]).to.equal(403);
                expect(axiosStub.calledOnce).to.be.false;
            });

            it('succeeds if right token given', async function() {
                axiosStub = sinon.spy(axios, 'get');
                let req = {
                    body: {
                        room_id: '!foobar:domain.tld',
                        token: 'foobar',
                    },
                    header: (header) => {
                        return header === 'Authorization' ? 'Bearer token' : '';
                    },
                };
                let res = {
                    send: sinon.spy(),
                    status: sinon.spy(),
                };
                await routes.postVerifyUserInRoom(req, res);
                expect(res.send.calledOnce).to.be.true;
                expect(res.status.calledOnce).to.be.false;
                expect(axiosStub.calledOnce).to.be.true;
            });
        });
    });
});
