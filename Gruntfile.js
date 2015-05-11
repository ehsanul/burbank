module.exports = function(grunt) {
  grunt.initConfig({
    watch: {
      scripts: {
        files: '**/*.ts',
        tasks: ['ts'],
      },
    },
    ts: {
      default : {
        src: ['**/*.ts', '!node_modules/**/*.ts'],
      },
    },
  });
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-ts');
  grunt.registerTask('default', ['watch']);
};
