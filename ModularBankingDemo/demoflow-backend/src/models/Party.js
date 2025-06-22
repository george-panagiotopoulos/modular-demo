/**
 * Party Data Model
 * Represents a bank customer/party with all their properties
 */

class Party {
  constructor(data = {}) {
    this.partyId = data.partyId || '';
    this.displayName = data.displayName || '';
    this.firstName = data.firstName || '';
    this.lastName = data.lastName || '';
    this.email = data.email || '';
    this.phone = data.phone || '';
    this.address = data.address || {};
    this.dateOfBirth = data.dateOfBirth || '';
    this.customerType = data.customerType || 'INDIVIDUAL';
    this.status = data.status || 'active';
    this.createdDate = data.createdDate || '';
  }

  /**
   * Create Party from Temenos party data
   * @param {Object} partyData - Temenos party object
   * @returns {Party} - Party instance
   */
  static fromTemenosParty(partyData) {
    const party = new Party();
    
    if (partyData.partyId) {
      party.partyId = partyData.partyId;
    }
    
    // Map customer details
    if (partyData.customerDetails) {
      const details = partyData.customerDetails;
      party.firstName = details.firstName || '';
      party.lastName = details.lastName || '';
      party.displayName = `${party.firstName} ${party.lastName}`.trim() || details.customerName || '';
      party.dateOfBirth = details.dateOfBirth || '';
      party.customerType = details.customerType || 'INDIVIDUAL';
    }
    
    // Map contact information
    if (partyData.contactDetails) {
      const contact = partyData.contactDetails;
      if (contact.email && contact.email.length > 0) {
        party.email = contact.email[0].emailAddress || '';
      }
      if (contact.phone && contact.phone.length > 0) {
        party.phone = contact.phone[0].phoneNumber || '';
      }
    }
    
    // Map address information
    if (partyData.addressDetails && partyData.addressDetails.length > 0) {
      const address = partyData.addressDetails[0];
      party.address = {
        street: address.addressLine1 || '',
        city: address.city || '',
        state: address.state || '',
        postalCode: address.postalCode || '',
        country: address.country || ''
      };
    }
    
    party.status = partyData.status || 'active';
    party.createdDate = partyData.createdDate || '';
    
    return party;
  }

  /**
   * Create a simplified Party for basic operations
   * @param {string} partyId - Party ID
   * @param {string} displayName - Display name
   * @returns {Party} - Basic Party instance
   */
  static createBasic(partyId, displayName = '') {
    return new Party({
      partyId,
      displayName: displayName || `Customer ${partyId}`,
      status: 'active'
    });
  }

  /**
   * Convert to JSON representation
   * @returns {Object} - JSON object
   */
  toJSON() {
    return {
      partyId: this.partyId,
      displayName: this.displayName,
      firstName: this.firstName,
      lastName: this.lastName,
      email: this.email,
      phone: this.phone,
      address: this.address,
      dateOfBirth: this.dateOfBirth,
      customerType: this.customerType,
      status: this.status,
      createdDate: this.createdDate
    };
  }

  /**
   * Get full name
   * @returns {string} - Full name
   */
  getFullName() {
    if (this.firstName && this.lastName) {
      return `${this.firstName} ${this.lastName}`;
    }
    return this.displayName || `Customer ${this.partyId}`;
  }

  /**
   * Validate party data
   * @returns {Object} - Validation result
   */
  validate() {
    const errors = [];
    
    if (!this.partyId) {
      errors.push('Party ID is required');
    }
    
    if (!this.displayName && !this.firstName && !this.lastName) {
      errors.push('At least one name field is required');
    }
    
    if (this.email && !this.isValidEmail(this.email)) {
      errors.push('Invalid email format');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate email format
   * @param {string} email - Email to validate
   * @returns {boolean} - True if valid
   */
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}

module.exports = Party; 