-- dbo.a_customer_demographics_2_view



/* view a_customer_demographics_2_view: add view */


/* view a_customer_demographics_2_view: add view */


/* view a_customer_demographics_2_view: add view */

/* view a_customer_demographics_2_view: add view */


/* view a_customer_demographics_2_view: add view */


/* view a_customer_demographics_2_view: add view */


/* view a_customer_demographics_2_view: add view */


/* view a_customer_demographics_2_view: add view */


/* view a_customer_demographics_2_view: add view */


/* view a_customer_demographics_2_view: add view */


/* view a_customer_demographics_2_view: add view */


/* view a_customer_demographics_2_view: add view */
CREATE VIEW [dbo].[a_customer_demographics_2_view]
AS
SELECT        dbo.k12_tab.idnk12_k12, dbo.k12_tab.uptime_k12, dbo.k12_tab.upname_k12, dbo.k12_tab.e_code_k12, dbo.k12_tab.e_name_k12, dbo.k12_tab.e_fnam_k12, dbo.k12_tab.e_phon_k12, dbo.k12_tab.e_faxn_k12, 
                         dbo.k12_tab.e_attn_k12, dbo.k12_tab.e_emal_k12, dbo.k12_tab.e_madr_k12, dbo.k12_tab.e_note_k12, dbo.ka7_tab.idnka7_ka7, dbo.ka7_tab.uptime_ka7, dbo.ka7_tab.idnk12_ka7, dbo.ka7_tab.gduset_ka7, 
                         dbo.ka7_tab.frozen_ka7, dbo.ka7_tab.d_code_ka7, dbo.ka7_tab.d_name_ka7, dbo.ka7_tab.d_nam2_ka7, dbo.ka7_tab.d_nam3_ka7, dbo.ka7_tab.d_adr1_ka7, dbo.ka7_tab.d_adr2_ka7, dbo.ka7_tab.d_adr3_ka7, 
                         dbo.ka7_tab.d_adr4_ka7, dbo.ka7_tab.d_city_ka7, dbo.ka7_tab.d_stte_ka7, dbo.ka7_tab.d_zipc_ka7, dbo.ka7_tab.d_cntr_ka7, dbo.ka7_tab.d_attn_ka7, dbo.ka7_tab.d_phon_ka7, dbo.ka7_tab.d_faxn_ka7, 
                         dbo.ka7_tab.d_emal_ka7, dbo.ka7_tab.d_cell_ka7, dbo.ka6_tab.gdutbl_ka6, dbo.ka6_tab.idnka7_ka6, dbo.ka6_tab.idngdu_ka6
FROM            dbo.k12_tab RIGHT OUTER JOIN
                         dbo.ka6_tab ON dbo.k12_tab.idnk12_k12 = dbo.ka6_tab.idngdu_ka6 RIGHT OUTER JOIN
                         dbo.ka7_tab ON dbo.ka6_tab.idnka7_ka6 = dbo.ka7_tab.idnka7_ka7












