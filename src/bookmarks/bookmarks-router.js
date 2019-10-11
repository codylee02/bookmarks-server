const path = require("path");
const express = require("express");
const logger = require("../logger");
const BookmarksService = require("../bookmarks-service");
const xss = require("xss");

const bookmarksRouter = express.Router();
const bodyParser = express.json();

const sanitizeBookmark = bookmark => ({
  id: bookmark.id,
  title: xss(bookmark.title),
  url: xss(bookmark.url),
  description: xss(bookmark.description),
  rating: Number(xss(bookmark.rating))
});

bookmarksRouter
  .route("/api/bookmarks")
  .get((req, res, next) => {
    const knexInstance = req.app.get("db");
    BookmarksService.getAllBookmarks(knexInstance)
      .then(bookmarks => {
        res.json(bookmarks.map(sanitizeBookmark));
      })
      .catch(next);
  })
  .post(bodyParser, (req, res, next) => {
    const { title, url, description, rating } = req.body;
    const newBookmark = { title, url, description, rating };

    for (const [key, value] of Object.entries(newBookmark)) {
      if (value == null) {
        return res.status(400).json({
          error: { message: `Missing '${key}' in request body` }
        });
      }
    }

    const bookmark = {
      title,
      url,
      description,
      rating
    };

    BookmarksService.insertBookmark(req.app.get("db"), bookmark)
      .then(bookmark => {
        res
          .status(201)
          .location(path.posix.join(req.originalUrl, `/${bookmark.id}`))
          .json(sanitizeBookmark(bookmark));
      })
      .then(logger.info(`Bookmark with id ${bookmark.id} created`))
      .catch(next);
  });

bookmarksRouter
  .route("/api/bookmarks/:id")
  .all((req, res, next) => {
    BookmarksService.getById(req.app.get("db"), req.params.id).then(
      bookmark => {
        if (!bookmark) {
          return res.status(404).json({
            error: { message: `Bookmark doesn't exist` }
          });
        }
        res.bookmark = bookmark;
        next();
      }
    );
  })
  .get((req, res, next) => {
    res.json(sanitizeBookmark(res.bookmark));
  })
  .delete((req, res, next) => {
    BookmarksService.deleteBookmark(req.app.get("db"), req.params.id)
      .then(() => {
        res.status(204).end();
      })
      .catch(next);
  })
  .patch(bodyParser, (req, res, next) => {
    const { title, url, description, rating } = req.body;
    const bookmarkToUpdate = { title, url, description, rating };

    const numberOfValues = Object.values(bookmarkToUpdate).filter(Boolean)
      .length;
    if (numberOfValues === 0) {
      return res.status(400).json({
        error: {
          message: `Request body must contain either 'title', 'url', 'description' or 'rating'`
        }
      });
    }

    BookmarksService.updateBookmark(
      req.app.get("db"),
      req.params.id,
      bookmarkToUpdate
    )
      .then(numRowsAffected => {
        res.status(204).end();
      })
      .catch(next);
  });

module.exports = bookmarksRouter;
