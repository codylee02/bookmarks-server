const { expect } = require("chai");
const knex = require("knex");
const bookmarksRouter = require("../src/bookmarks/bookmarks-router");
const app = require("../src/app");
const { makeBookmarksArray } = require("./bookmarks.fixtures");

describe("Bookmarks Endpoints", () => {
  let db;

  before("make knex instance", () => {
    db = knex({
      client: "pg",
      connection: process.env.TEST_DB_URL
    });
    app.set("db", db);
  });

  after("disconnect from db", () => db.destroy());

  before("clean the table", () => db("bookmarks_list").truncate());

  afterEach("cleanup", () => db("bookmarks_list").truncate());
  describe(`GET /bookmarks`, () => {
    context(`Given no articles`, () => {
      it(`responds 200 and an empty list`, () => {
        return supertest(app)
          .get("/bookmarks")
          .set("Authorization", `Bearer ${process.env.API_TOKEN}`);
      });
    });
    context(`Given there are bookmarks in the database`, () => {
      const testBookmarks = makeBookmarksArray();

      beforeEach("insert bookmarks", () => {
        return db.into("bookmarks_list").insert(testBookmarks);
      });

      it("GET /bookmarks responds with 200 and all of the bookmarks", () => {
        return supertest(app)
          .get("/bookmarks")
          .set("Authorization", `Bearer ${process.env.API_TOKEN}`)
          .expect(200, testBookmarks);
      });
    });
    context("Given there is no authorization header provided ", () => {
      it("responds with 401 and unathorized request", () => {
        const bookmarkId = 5;
        const expectedResponse = { error: "Unauthorized request" };
        return supertest(app)
          .get(`/bookmarks/`)
          .expect(401, expectedResponse);
      });
    });
  });
  describe("GET /bookmarks/:id", () => {
    context("Given no bookmark", () => {
      it("responds with 404", () => {
        const bookmarkId = 123456;
        return supertest(app)
          .get(`/bookmarks/${bookmarkId}`)
          .set("Authorization", `Bearer ${process.env.API_TOKEN}`)

          .expect(404, { error: { message: `Bookmark not found.` } });
      });
    });

    context("Given there are bookmarks in the database", () => {
      const testBookmarks = makeBookmarksArray();

      beforeEach("insert bookmarks", () => {
        return db.into("bookmarks_list").insert(testBookmarks);
      });
      it("responds with 200 and the specified bookmark", () => {
        const bookmarkId = 5;
        const expectedBookmark = testBookmarks[bookmarkId - 1];
        return supertest(app)
          .get(`/bookmarks/${bookmarkId}`)
          .set("Authorization", `Bearer ${process.env.API_TOKEN}`)
          .expect(200, expectedBookmark);
      });
    });
    context("Given there is no authorization header provided ", () => {
      it("responds with 401 and unathorized request", () => {
        const bookmarkId = 5;
        const expectedResponse = { error: "Unauthorized request" };
        return supertest(app)
          .get(`/bookmarks/${bookmarkId}`)
          .expect(401, expectedResponse);
      });
    });
  });
});
