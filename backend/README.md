# Backend API

Express.js backend with MVC architecture

## Project Structure

```
backend/
├── src/
│   ├── config/          # Configuration files
│   ├── controllers/     # Route controllers
│   ├── models/          # Data models
│   ├── routes/          # API routes
│   ├── middleware/      # Custom middleware
│   ├── utils/           # Utility functions
│   └── app.js           # Express app setup
├── server.js            # Entry point
├── package.json         # Dependencies
├── .env                 # Environment variables
└── README.md
```

## Installation

1. Install dependencies:

```bash
npm install
```

2. Configure environment variables in `.env` file

3. Start the development server:

```bash
npm run dev
```

Or start the production server:

```bash
npm start
```

## API Endpoints

### Health Check

- `GET /api/health` - Check if server is running

### Examples (CRUD)

- `GET /api/examples` - Get all examples
- `GET /api/examples/:id` - Get example by ID
- `POST /api/examples` - Create new example
- `PUT /api/examples/:id` - Update example
- `DELETE /api/examples/:id` - Delete example

## Technologies Used

- **Express.js** - Web framework
- **dotenv** - Environment variable management
- **CORS** - Cross-origin resource sharing
- **Morgan** - HTTP request logger
- **Nodemon** - Development auto-restart (dev only)

## Development

For development with auto-restart on file changes:

```bash
npm run dev
```

## Environment Variables

Create a `.env` file based on `.env.example`:

```
NODE_ENV=development
PORT=5000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=password
DB_NAME=dev_db
DB_PORT=3306
```
