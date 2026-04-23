-- dbo.customer_contact_notes_1_view



/* view customer_contact_notes_1_view: add view */


/* view customer_contact_notes_1_view: add view */


/* view customer_contact_notes_1_view: add view */

/* view customer_contact_notes_1_view: add view */


/* view customer_contact_notes_1_view: add view */


/* view customer_contact_notes_1_view: add view */


/* view customer_contact_notes_1_view: add view */


/* view customer_contact_notes_1_view: add view */


/* view customer_contact_notes_1_view: add view */


/* view customer_contact_notes_1_view: add view */
CREATE VIEW [dbo].[customer_contact_notes_1_view]
AS
SELECT        dbo.kah_tab.a_note_kah, dbo.ka7_tab.idnka7_ka7, dbo.kah_tab.idnkah_kah, dbo.ka7_tab.idnk12_ka7, dbo.kah_tab.anutbl_kah, dbo.kah_tab.idnanu_kah, dbo.kah_tab.anutyp_kah, dbo.ka7_tab.uptime_ka7, 
                         dbo.ka7_tab.gduset_ka7, dbo.ka7_tab.frozen_ka7, dbo.ka7_tab.d_code_ka7, dbo.ka7_tab.d_name_ka7, dbo.ka7_tab.d_nam2_ka7, dbo.ka7_tab.d_nam3_ka7, dbo.ka7_tab.d_adr1_ka7, dbo.ka7_tab.d_adr2_ka7, 
                         dbo.ka7_tab.d_adr3_ka7, dbo.ka7_tab.d_adr4_ka7, dbo.ka7_tab.d_city_ka7, dbo.ka7_tab.d_stte_ka7, dbo.ka7_tab.d_zipc_ka7, dbo.ka7_tab.d_cntr_ka7, dbo.ka7_tab.d_attn_ka7, dbo.ka7_tab.d_phon_ka7, 
                         dbo.ka7_tab.d_faxn_ka7, dbo.ka7_tab.d_emal_ka7, dbo.ka7_tab.d_cell_ka7
FROM            dbo.kah_tab RIGHT OUTER JOIN
                         dbo.ka7_tab ON dbo.kah_tab.idnanu_kah = dbo.ka7_tab.idnka7_ka7










