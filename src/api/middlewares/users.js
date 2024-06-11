const current = req.user;
let users = [current];
if (current.createdBy) {
  let tempUsers = await User.find({
    $or: [{ createdBy: current.createdBy }, { _id: current.createdBy }],
  });
  if (tempUsers && Array.isArray(tempUsers)) users.push(...tempUsers);
} else {
  let tempUsers = await User.find({ createdBy: current._id });
  if (tempUsers && Array.isArray(tempUsers)) users.push(...tempUsers);
}

// Get the IDs of all users (including createdByUser)
const userIds = [...users.map((user) => user._id)];
// Get the list of QR IDs for the user
const userQRs = await QR.find({ user: userIds }).select("_id");
