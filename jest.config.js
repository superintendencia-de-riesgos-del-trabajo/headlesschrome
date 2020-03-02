module.exports = {
	globals: {
		'ts-jest': {
			tsConfig: 'tsconfig.json'
		}
	},
	moduleFileExtensions: [
		'ts',
		'js',
		'json'
	],
	transform: {
		'^.+\\.(ts|tsx)$': 'ts-jest'
	},
	testMatch: [
		'**/*.spec.ts'
	],
	testEnvironment: 'node',
	setupFilesAfterEnv: ["jest-extended","expect-more"]
};
