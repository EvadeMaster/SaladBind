process.on("uncaughtException", err => {
	try {
		console.clear();
		console.log(`${chalk.bold.red("Oh noes! A scary error!")}\nTechnical details: ${err.message}`);
		if(err.message.includes("EPERM")) console.log(chalk.blueBright("This *could* be your antivirus."))
		inquirer.prompt({
			name: "exit",
			message: "What do you want to do?",
			type: "list",
			choices: [{
					name: "Write to log and exit",
					value: "write_log"
				},
				{
					name: "Exit",
					value: "exit"
				},
				{
					"name": "",
					"value": ""
				}
			]
		}).then(out => {
			if (out.exit == "exit" || out.exit == "") process.exit(1)
			else if (out.exit == "write_log") {
				try {
					fs.writeFileSync(`${envPaths('SaladBind', { suffix: "" }).data}/saladbind_error.txt`, `Hi! I'm a SaladBind Error Log.\nI'm now going to puke everything I know at you. I hope you don't mind (it's very technical :D)\n\nThe error was ${err}\n\nHere's the stacktrace, so we can figure out where the error is coming from:\n${err.stack}\n\nAnd finally, some cool debug information I made just for you!\nIt helps us find out if the person sitting in front of the screen is the problem.\n${JSON.stringify(getDebugData(), null, " ")}`);
					console.log(`\nWrote to "${envPaths('SaladBind', { suffix: "" }).data}/saladbind_error.txt" successfully\n`);
					process.exit(1);
				} catch(newErr) {
					try {
						console.log("Uh... While we tried to log the error, another error arrived!");
						console.log("NEW ERROR:", newErr);
						console.log("OLD ERROR:", err);
						console.log("DEBUG:", JSON.stringify(getDebugData()));
						setInterval(() => {
							// literally do nothing, make sure the user sees the error and it doesnt close instantly
						}, 10000);
					} catch {

					}
				}
				process.exit(1);
			}
		})
	} catch (newError) {
		console.log("ERROR: ", {
			err,
			newError
		});
		process.exit(1);
	}
});

const ora = require('ora'); // ara ara
const chalk = require('chalk');
const packageJson = require('../package.json');
const fs = require('fs');
const inquirer = require('inquirer');
const fetch = require("node-fetch");
const open = require("open");
const si = require("systeminformation");
const update = require("./update.js")
const { configFile, dataDirectory, saladbind_directory, run} = require("./setup");
const envPaths = require('env-paths');

function getDebugData() {
	function safelyReadAndParseFile(name) {
		let data;
		if(fs.existsSync(name)) {
			try {
				data = JSON.parse(fs.readFileSync(name).toString());
			} catch {
				data = "Error while reading/parsing"
			}
		} else {
			data = "None"
		}
		return data
	}
	let configData = safelyReadAndParseFile(configFile)
	let miners;
	try {
		miners = fs.readdirSync(`${dataDirectory}/miners`).join(", ")
	} catch {
		miners = "Error, data/miners folder might not exist or is unreachable."
	}
	let last = safelyReadAndParseFile(`${dataDirectory}/last.json`);
	let cache = safelyReadAndParseFile(`${dataDirectory}/cache.json`);
	if(typeof cache !== "object") {
		console.log("\nWARNING: It does not seem like you've entered the miner selection screen before, some data may be missing from the debug.\n")
	}
	return {
		timestamp: new Date().getTime(),
		configured: fs.existsSync(configFile),
		__dirname: __dirname,
		cwd: process.cwd(),
		version: packageJson.version,
		config: configData,
		platform: `${cache?.os?.platform} (${cache?.os?.distro} ${cache?.os?.release})`,
		system: `${cache?.system?.manufacturer} ${cache?.system?.version} ${cache?.system?.model}`,
		miners: miners,
		last: last,
		gpus: cache?.graphics?.controllers,
	}
}
if(process.argv[process.argv.length-1] == "-d") {
	try {
		fs.writeFileSync(`${envPaths('SaladBind', { suffix: "" }).log}/saladbind-debug.txt`, JSON.stringify(getDebugData(), null, " "));
		console.log(`\nWrote to "${envPaths('SaladBind', { suffix: "" }).log}/saladbind-debug.txt" successfully\n`)
	} catch (err) {
		console.log("Could not write debug (no permissions?). Here's some debug data:");
		console.log({
			err: err.stack,
			debug: getDebugData()
		})
	}
	process.exit();
}
let dontStart = false
if(process.argv[process.argv.length-1] == "-l") {
	dontStart=true
	require("./mining").quick(true);
	
}
console.clear();

const aprilfools = new Date().getMonth() == 3 && new Date().getDate() == 1;
process.title = `${aprilfools ? "VegetableJoiner" : "SaladBind"} v${packageJson.version}`;

(async() => {
	update.updateCheck.then(() => {
			if (!fs.existsSync(configFile)) {
				if(!dontStart) run(false);
			} else {
				console.log(chalk.bold.green(`SaladBind v${packageJson.version}`));
				console.clear();
				if(!dontStart) menu(false);
			}
	})
})();
async function menu(clear) {
	if (clear == undefined || clear == true) {
		console.clear();
	}
	console.log(chalk.bold.green(`${aprilfools ? "VegetableJoiner" : "SaladBind"} v${packageJson.version}\nFor support see https://wiki.litdevs.org/wiki/SaladBind/FAQ`));
	console.log("Please note that there is absolutely no support for SaladBind.")
	let choices = [{
		name: 'Start mining',
		value: 'mining'
	},
	{
		name: 'Settings',
		value: 'config'
	},
	{
		name: 'What\'s new?',
		value: 'changes'
	},
	{
		name: 'SaladBind FAQ/Troubleshooting guide',
		value: 'help'
	},
	{
		name: 'Exit SaladBind',
		value: 'exit'
	}
]
if (fs.existsSync(`${dataDirectory}/last.json`)){
	choices.unshift({
		name: 'Start latest miner',
		value: 'quick'
	})
}
	const questions = [{
		type: 'list',
		name: 'menu',
		message: 'What would you like to do?',
		choices: choices
	}];
	const answers = await inquirer.prompt(questions);
	switch (answers.menu) {
		case 'quick':
			require("./mining").quick();
			break;
		case 'mining':
			require("./mining").run();
			break;
		case 'config':
			require("./setup").run();
			break;
		case 'changes':
			const spinner = ora('Fetching the Changelogs').start();
			fetch('https://raw.githubusercontent.com/EvadeMaster/SaladBind/main/internal/changelog.json')
				.then(res => res.json())
				.then(data => {
					console.clear();
					spinner.succeed(chalk.bold.green(`What's new in the latest update - ${data.version}`));
					data.changelog.forEach(item => {
						console.log(`- ${item}`)
					});
					console.log();
					inquirer.prompt({
						type: 'input',
						name: 'backtomenu',
						message: 'Press ENTER to return to the menu.'
					}).then(function() {
						menu();
					});
				})
			break;
		case 'help':
			let temp = await si.osInfo()
			if (temp.platform == "linux") {
				console.log("\nhttps://wiki.litdevs.org/wiki/SaladBind/FAQ");
			} else {
				open("https://wiki.litdevs.org/wiki/SaladBind/FAQ");
				console.log("\nOpened the SaladBind troubleshooting page in your browser!");
			}
			setTimeout(() => {
				process.title = `${aprilfools ? "VegetableJoiner" : "SaladBind"} v${packageJson.version}`; // very lazy solution, I know.
				menu();
			}, 3500);
			break;
		case 'exit':
			console.clear();
			process.exit(0);
		default:
			menu();
			break;
	}
}

module.exports = {
	menu
}
