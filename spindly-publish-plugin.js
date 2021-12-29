let { SpindlyMake } = require("./spindly-make");
let { BuildPackages } = require("./spindly-publish");


let Verbose = true;

exports.SpindlyPublish = () => {

  return {
    name: "SpindlyPublish", // this name will show up in warnings and errors
    async buildStart() {
      try {
        await SpindlyMake(Verbose);
        await BuildPackages();

      } catch (error) {
        console.error(error);
      }
      console.log("Spindly Build Finished");

      return null;
    },
  };
}