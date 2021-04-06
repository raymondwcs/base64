const http = require('http');
const url = require('url');
const fs = require('fs');
const formidable = require('formidable');
const { MongoClient } = require("mongodb");
const { ObjectID } = require('mongodb').ObjectID;
const dbName = "test";
const collectionName = 'photos'
// Replace the uri string with your MongoDB deployment's connection string.
const uri = ``;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const server = http.createServer((req, res) => {
  let timestamp = new Date().toISOString();
  console.log(`Incoming request ${req.method}, ${req.url} received at ${timestamp}`);

  let parsedURL = url.parse(req.url, true); // true to get query as object

  if (parsedURL.pathname == '/fileupload' &&
    req.method.toLowerCase() == "post") {
    // parse a file upload
    const form = new formidable.IncomingForm();
    form.parse(req, (err, fields, files) => {
      // console.log(JSON.stringify(files));
      if (files.filetoupload.size == 0) {
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end("No file uploaded!");
      }
      const filename = files.filetoupload.path;
      const title = (fields.title && fields.title.length > 0) ? fields.title : "untitled";
      const mimetype = (files.filetoupload.type) ? files.filetoupload.type : "images/jpeg";
      fs.readFile(files.filetoupload.path, (err, data) => {
        client.connect(err => {
          if (err) {
            res.writeHead(500, { "Content-Type": "text/plain" });
            res.end("MongoClient connect() failed!");
          }

          const db = client.db(dbName)

          let new_r = {};
          new_r['title'] = title;
          new_r['mimetype'] = mimetype;
          new_r['image'] = new Buffer.from(data).toString('base64');

          db.collection(collectionName).insertOne(new_r, (err, results) => {
            if (!err && results.insertedCount == 1) {
              console.log(results)
              res.writeHead(200, { "Content-Type": "text/html" });
              res.write('<html><body>Photo was inserted into MongoDB!<br>');
              res.end('<a href="/photos">Back</a></body></html>')
            } else {
              res.writeHead(500, { "Content-Type": "text/plain" });
              res.end(JSON.stringify(err))
            }
          })
        })
      });
    })
  } else if (parsedURL.pathname == '/photos') {
    client.connect(err => {
      if (err) {
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end("MongoClient connect() failed!");
      }

      const db = client.db(dbName)

      findPhoto(db, {}, (photos) => {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.write('<html><head><title>Photos</title></head>');
        res.write('<body><H1>Photos</H1>');
        res.write('<H2>Showing ' + photos.length + ' document(s)</H2>');
        res.write('<ol>');
        for (i in photos) {
          res.write('<li><a href=/display?_id=' +
            photos[i]._id + '>' + photos[i].title + '</a></li>');
        }
        res.write('</ol>');
        res.end('</body></html>');
      })
    })
  } else if (parsedURL.pathname == '/display') {
    client.connect(err => {
      if (err) {
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end("MongoClient connect() failed!");
      }

      const db = client.db(dbName)

      let criteria = {};
      criteria['_id'] = ObjectID(parsedURL.query._id);
      findPhoto(db, criteria, (photo) => {
        console.log('Photo returned = ' + photo.length);
        let image = new Buffer.from(photo[0].image, 'base64');
        let contentType = {};
        contentType['Content-Type'] = photo[0].mimetype;
        if (contentType['Content-Type'] == "image/jpeg") {
          console.log('Preparing to send ' + JSON.stringify(contentType));
          res.writeHead(200, contentType);
          res.end(image);
        } else {
          res.writeHead(500, { "Content-Type": "text/plain" });
          res.end("Not JPEG format!!!");
        }
      })
    })
  } else {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.write('<form action="fileupload" method="post" enctype="multipart/form-data">');
    res.write('Title: <input type="text" name="title" minlength=1><br>');
    res.write('<input type="file" name="filetoupload"><br>');
    res.write('<input type="submit">');
    res.write('</form>');
    res.end();
  }
});

const findPhoto = (db, criteria, callback) => {
  const cursor = db.collection(collectionName).find(criteria);
  cursor.toArray((err, photos) => {
    if (!err) {
      console.log(photos)
      callback(photos)
    } else {
      console.error(`findPhoto(): ${err}`)
      callback([])
    }
  })
}

server.listen(process.env.PORT || 8099);
