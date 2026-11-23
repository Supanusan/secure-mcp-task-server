import mongoose from "mongoose";

const taskSchema = new mongoose.Schema(
  {
    ownerId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 120,
    },

    completed: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

export const Task = mongoose.model("Task", taskSchema);
