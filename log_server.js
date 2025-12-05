const express =require ('express');
const app = express();
const PORT = 4000; 

app.use(express.json());

app.post('/api/logs', (req,res) => {
	const log = req.body || {};
	console.log('REMOTE LOG FROM BE:', log); 
	res.json({ status: 'ok' }); 
}); 

app.listen(PORT, '0.0.0.0', () => {
	console.log(`Logging server listening on port ${PORT}`);
}); 
