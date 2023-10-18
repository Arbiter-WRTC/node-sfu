import express from 'express';
import cors from "cors";

const app = express();

app.use(cors());

app.get('/', (req, res) => {
  res.send('Here we go YO');
});

export default app;