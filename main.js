// load required modules and libraries
const express = require('express');
const handlebars = require('express-handlebars');
// get the driver with promise support
const mysql = require('mysql2/promise');

// configure port to listen, default is 3000, and other global constants
const PORT = parseInt(process.argv[2]) || parseInt(process.env.APP_PORT) || 3000;

// SQL statements
const SQL_FIND_BY_NAME = 'select * from apps where name like ? limit ?'; // ? are the placeholders, never use string concatenation

// create the database connection pool
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PW,
    database: process.env.DB_NAME || 'playstore',
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT) || 4,
    timezone: '+08:00'
    // multipleStatements: true // need to set this if multiple statements are required
});

// check that the connection between the express server and the db server is up before starting the application
const startApp = async (app, pool) => {
    try {
        // get a sonnection from the connection pool
        const conn = await pool.getConnection();

        console.info('We are pinging the database..');
        await conn.ping();

        // if above ping is successful, the connection is up and we need to release the connection
        conn.release();

        // start the server
        app.listen(PORT, () => {
            console.info(`Express-DB Connection up. Server started at port ${PORT} on ${new Date()}`);
        });
    } catch(e) {
        console.error('Cannot ping database: ', e);
    }
}

// create an instance of express
const app = express();

// configure handlebars as the render engine
app.engine('hbs', handlebars({ defaultLayout: 'default.hbs' }));
app.set('view engine', 'hbs');

// define middleware to handle the various routes
app.get('/', (req, res, next) => {
    res.status(200).type('text/html');
    res.render('index');
});

app.get('/search', async (req, res, next) => {
    const search = req.query['textInput'];
    console.info('Search Key: ', search);

    // acquire a connection from the pool
    const conn = await pool.getConnection();

    try {
        // perform the query
        const result = await conn.query(SQL_FIND_BY_NAME, [ `%${search}%`, 10 ]);
        const records = result[0];

        console.info('records = ', records);

        res.status(200).type('text/html');
        // res.send(`Received search request with textInput: ${search}`);
        res.render('index', { search: `Results for ${search} are:`, itemsToDisplay: records });
    } catch(e) {
        console.error('Internal server error occurred [Express-DB].', e);
        res.status(500).type('text/html');
        res.send(`Internal server error [Express-DB] from request with textInput: ${search}`);
    } finally {
        // release connection
        conn.release();
    }
});

app.use(express.static(__dirname + '/public'));

// start the express server
startApp(app, pool);