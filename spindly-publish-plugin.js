let { SpindlyMake } = require("./spindly-make");


let Verbose = true;

exports.SpindlyPublish = () => {

  return {
    name: "SpindlyPublish", // this name will show up in warnings and errors
    async buildStart() {
      try {
        await SpindlyMake(Verbose);
      } catch (error) {
        console.error(error);
      }
      console.log("Spindly Build Finished");

      return null;
    },
  };
}