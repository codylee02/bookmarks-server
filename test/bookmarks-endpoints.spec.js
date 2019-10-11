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

  describe(`GET /api/bookmarks`, () => {
    context(`Given no bookmarks`, () => {
      it(`responds 200 and an empty list`, () => {
        return supertest(app)
          .get("/api/bookmarks")
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
          .get("/api/bookmarks")
          .set("Authorization", `Bearer ${process.env.API_TOKEN}`)
          .expect(200, testBookmarks);
      });
    });

    context("Given there is no authorization header provided ", () => {
      it("responds with 401 and unathorized request", () => {
        const bookmarkId = 5;
        const expectedResponse = { error: "Unauthorized request" };
        return supertest(app)
          .get(`/api/bookmarks/`)
          .expect(401, expectedResponse);
      });
    });
  });

  describe("GET /api/bookmarks/:id", () => {
    context("Given no bookmark", () => {
      it("responds with 404", () => {
        const bookmarkId = 123456;
        return supertest(app)
          .get(`/api/bookmarks/${bookmarkId}`)
          .set("Authorization", `Bearer ${process.env.API_TOKEN}`)

          .expect(404, { error: { message: `Bookmark doesn't exist` } });
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
          .get(`/api/bookmarks/${bookmarkId}`)
          .set("Authorization", `Bearer ${process.env.API_TOKEN}`)
          .expect(200, expectedBookmark);
      });
    });

    context("Given there is no authorization header provided ", () => {
      it("responds with 401 and unathorized request", () => {
        const bookmarkId = 5;
        const expectedResponse = { error: "Unauthorized request" };
        return supertest(app)
          .get(`/api/bookmarks/${bookmarkId}`)
          .expect(401, expectedResponse);
      });
    });

    context("Given an XSS attack bookmark", () => {
      const maliciousBookmark = {
        id: 911,
        title: 'Naughty naughty very naughty <script>alert("xss");</script>',
        url: "www.not-real-website.com",
        description: `Bad image <img src="https://url.to.file.which/does-not.exist" onerror="alert(document.cookie);">. But not <strong>all</strong> bad.`,
        rating: 5
      };

      beforeEach("insert malicious bookmark", () => {
        return db.into("bookmarks_list").insert([maliciousBookmark]);
      });

      it("removes XSS attack content", () => {
        return supertest(app)
          .get(`/api/bookmarks/${maliciousBookmark.id}`)
          .set("Authorization", `Bearer ${process.env.API_TOKEN}`)
          .expect(200)
          .expect(res => {
            expect(res.body.title).to.eql(
              'Naughty naughty very naughty &lt;script&gt;alert("xss");&lt;/script&gt;'
            );
            expect(res.body.description).to.eql(
              `Bad image <img src="https://url.to.file.which/does-not.exist">. But not <strong>all</strong> bad.`
            );
          });
      });
    });
  });

  describe("POST /api/bookmarks", () => {
    it("create a new bookmark, responding with 201 and the new bookmark", () => {
      const newBookmark = {
        title: "Test Bookmark",
        url: "www.testbookmark.com",
        description: "test description",
        rating: 5
      };
      return supertest(app)
        .post("/api/bookmarks")
        .send(newBookmark)
        .set("Authorization", `Bearer ${process.env.API_TOKEN}`)
        .expect(201)
        .expect(res => {
          expect(res.body.title).to.eql(newBookmark.title);
          expect(res.body.url).to.eql(newBookmark.url);
          expect(res.body.description).to.eql(newBookmark.description);
          expect(res.body.rating).to.eql(newBookmark.rating);
          expect(res.headers.location).to.eql(`/api/bookmarks/${res.body.id}`);
        })
        .then(bookmarksRes =>
          supertest(app)
            .get(`/api/bookmarks/${bookmarksRes.body.id}`)
            .set("Authorization", `Bearer ${process.env.API_TOKEN}`)
            .expect(bookmarksRes.body)
        );
    });
  });

  describe("DELETE /api/bookmarks/:id", () => {
    context("Given there are bookmarks in the database", () => {
      const testBookmarks = makeBookmarksArray();

      beforeEach("insert bookmarks", () => {
        return db.into("bookmarks_list").insert(testBookmarks);
      });

      it("responds with 204 and removes the bookmark", () => {
        const idToRemove = 2;
        const expectedBookmarks = testBookmarks.filter(
          bookmark => bookmark.id !== idToRemove
        );
        return supertest(app)
          .delete(`/api/bookmarks/${idToRemove}`)
          .set("Authorization", `Bearer ${process.env.API_TOKEN}`)
          .expect(204)

          .then(() => {
            supertest(app)
              .get("/api/bookmarks")
              .set("Authorization", `Bearer ${process.env.API_TOKEN}`)
              .expect(expectedBookmarks);
          });
      });
    });

    context("Given no bookmarks", () => {
      it(`responds with 404`, () => {
        const bookmarkId = 123456;
        return supertest(app)
          .delete(`/api/bookmarks/${bookmarkId}`)
          .set("Authorization", `Bearer ${process.env.API_TOKEN}`)
          .expect(404, { error: { message: `Bookmark doesn't exist` } });
      });
    });
  });

  describe(`PATCH /api/bookmarks/:id`, () => {
    context(`Given no bookmarks`, () => {
      it(`responds with 404`, () => {
        const bookmarkId = 123456;
        return supertest(app)
          .patch(`/api/bookmarks/${bookmarkId}`)
          .set("Authorization", `Bearer ${process.env.API_TOKEN}`)
          .expect(404, { error: { message: `Bookmark doesn't exist` } });
      });
    });

    context(`Given there are bookmarks in the database`, () => {
      const testBookmarks = makeBookmarksArray();

      beforeEach("insert bookmarks", () => {
        return db.into("bookmarks_list").insert(testBookmarks);
      });

      it("responds with 204 and updates the bookmark", () => {
        const idToUpdate = 2;
        const updateBookmark = {
          title: "updated title",
          url: "www.updated-website.com",
          description: "updated description",
          rating: 5
        };

        const expectedBookmark = {
          ...testBookmarks[idToUpdate - 1],
          ...updateBookmark
        };
        return supertest(app)
          .patch(`/api/bookmarks/${idToUpdate}`)
          .send(updateBookmark)
          .set("Authorization", `Bearer ${process.env.API_TOKEN}`)
          .expect(204)
          .then(res =>
            supertest(app)
              .get(`/api/bookmarks/${idToUpdate}`)
              .set("Authorization", `Bearer ${process.env.API_TOKEN}`)
              .expect(expectedBookmark)
          );
      });
      it("responds with 400 when no required fields supplied", () => {
        const idToUpdate = 2;
        return supertest(app)
          .patch(`/api/bookmarks/${idToUpdate}`)
          .set("Authorization", `Bearer ${process.env.API_TOKEN}`)
          .send({ irrelevantField: "foo" })
          .expect(400, {
            error: {
              message: `Request body must contain either 'title', 'url', 'description' or 'rating'`
            }
          });
      });

      it(`responds with 204 when updating only a subset of fields,`, () => {
        const idToUpdate = 2;
        const updateBookmark = {
          title: "updated title"
        };
        const expectedBookmark = {
          ...testBookmarks[idToUpdate - 1],
          ...updateBookmark
        };

        return supertest(app)
          .patch(`/api/bookmarks/${idToUpdate}`)
          .send({
            ...updateBookmark,
            fieldToIgnore: "should not be in GET response"
          })
          .set("Authorization", `Bearer ${process.env.API_TOKEN}`)
          .expect(204)
          .then(res =>
            supertest(app)
              .get(`/api/bookmarks/${idToUpdate}`)
              .set("Authorization", `Bearer ${process.env.API_TOKEN}`)
              .expect(expectedBookmark)
          );
      });
    });
  });
});
