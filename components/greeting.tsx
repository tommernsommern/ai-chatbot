import { motion } from "framer-motion";

export const Greeting = () => {
  return (
    <div
      className="flex min-h-[calc(100vh-200px)] w-full items-center justify-center"
      key="overview"
    >
      <div className="flex flex-col items-center justify-center text-center">
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          className="font-semibold text-xl md:text-2xl"
          exit={{ opacity: 0, y: 10 }}
          initial={{ opacity: 0, y: 10 }}
          transition={{ delay: 0.5 }}
        >
          Hei der!
        </motion.div>
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          className="text-xl text-zinc-500 md:text-2xl"
          exit={{ opacity: 0, y: 10 }}
          initial={{ opacity: 0, y: 10 }}
          transition={{ delay: 0.6 }}
        >
          Hvordan kan jeg hjelpe deg i dag?
        </motion.div>
      </div>
    </div>
  );
};
