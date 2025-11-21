class BooksyService {
  constructor(apiKey, shopId) {
    this.apiKey = apiKey;
    this.shopId = shopId;
    this.baseUrl = 'https://us.booksy.com/api/us/2';
  }

  // Get appointments
  async getAppointments(startDate, endDate) {
    try {
      const response = await fetch(
        `${this.baseUrl}/businesses/${this.shopId}/bookings?start_date=${startDate}&end_date=${endDate}`,
        {
          headers: {
            'X-Api-Key': this.apiKey,
            'Content-Type': 'application/json'
          }
        }
      );
      return await response.json();
    } catch (error) {
      console.error('Booksy get appointments error:', error);
      throw error;
    }
  }

  // Create appointment
  async createAppointment(data) {
    try {
      const response = await fetch(
        `${this.baseUrl}/businesses/${this.shopId}/bookings`,
        {
          method: 'POST',
          headers: {
            'X-Api-Key': this.apiKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            service_id: data.serviceId,
            staff_id: data.staffId,
            start_time: data.startTime,
            client: {
              name: data.clientName,
              phone: data.clientPhone,
              email: data.clientEmail
            }
          })
        }
      );
      return await response.json();
    } catch (error) {
      console.error('Booksy create appointment error:', error);
      throw error;
    }
  }

  // Cancel appointment
  async cancelAppointment(bookingId) {
    try {
      const response = await fetch(
        `${this.baseUrl}/businesses/${this.shopId}/bookings/${bookingId}`,
        {
          method: 'DELETE',
          headers: {
            'X-Api-Key': this.apiKey,
            'Content-Type': 'application/json'
          }
        }
      );
      return await response.json();
    } catch (error) {
      console.error('Booksy cancel error:', error);
      throw error;
    }
  }
}

export default BooksyService;