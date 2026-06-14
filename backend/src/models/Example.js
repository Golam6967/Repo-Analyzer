// Example Model
// Replace with your actual model implementation

class Example {
  constructor(id, name, description) {
    this.id = id;
    this.name = name;
    this.description = description;
    this.createdAt = new Date();
  }

  static getAll() {
    // Implement database query
    return [];
  }

  static getById(id) {
    // Implement database query
    return null;
  }

  save() {
    // Implement save to database
    return this;
  }

  delete() {
    // Implement delete from database
    return true;
  }
}

module.exports = Example;
