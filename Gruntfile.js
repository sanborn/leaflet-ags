module.exports = function( grunt ) {
    grunt.initConfig({
      uglify: {
        dist: {
          files: {
            'dist/ags.min.js': 'dist/ags.min.js'
          }
        }
      },
      concat: {
        dist: {
          src: [
            'src/AGS.js',
            'src/AGS.Layer.js',
            'src/AGS.Layer.Dynamic.js',
            'src/AGS.Layer.Tiled.js',
            'src/AGS.Layer.Tiled.Dynamic.js',
            'src/AGS.Security.js',
            'src/AGS.Tools.js',
            'src/AGS.Tools.Identify.js'
          ],
          dest: 'dist/ags.min.js'
        }
      }
    });
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-contrib-concat');
    grunt.registerTask('default', ['concat', 'uglify']);
}
