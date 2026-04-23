-- dbo.demographics_2_view



/* view demographics_2_view: add view */


/* view demographics_2_view: add view */


/* view demographics_2_view: add view */

/* view demographics_2_view: add view */


/* view demographics_2_view: add view */


/* view demographics_2_view: add view */


/* view demographics_2_view: add view */


/* view demographics_2_view: add view */


/* view demographics_2_view: add view */


/* view demographics_2_view: add view */


/* view demographics_2_view: add view */


/* view demographics_2_view: add view */
CREATE VIEW [dbo].[demographics_2_view]
AS
SELECT        dbo.k31_tab.idnk31_k31, dbo.k31_tab.uptime_k31, dbo.k31_tab.upname_k31, dbo.k31_tab.idnk12_k31, dbo.k31_tab.a_code_k31, dbo.k31_tab.c_code_k31, dbo.k31_tab.c_name_k31, 
                         dbo.demographics_1_view.idnk12_k12, dbo.demographics_1_view.uptime_k12, dbo.demographics_1_view.upname_k12, dbo.demographics_1_view.e_code_k12, dbo.demographics_1_view.e_name_k12, 
                         dbo.demographics_1_view.e_fnam_k12, dbo.demographics_1_view.e_phon_k12, dbo.demographics_1_view.e_faxn_k12, dbo.demographics_1_view.e_attn_k12, dbo.demographics_1_view.e_emal_k12, 
                         dbo.demographics_1_view.e_madr_k12, dbo.demographics_1_view.e_note_k12, dbo.demographics_1_view.idnka7_ka7, dbo.demographics_1_view.uptime_ka7, dbo.demographics_1_view.idnk12_ka7, 
                         dbo.demographics_1_view.gduset_ka7, dbo.demographics_1_view.frozen_ka7, dbo.demographics_1_view.d_code_ka7, dbo.demographics_1_view.d_name_ka7, dbo.demographics_1_view.d_nam2_ka7, 
                         dbo.demographics_1_view.d_nam3_ka7, dbo.demographics_1_view.d_adr1_ka7, dbo.demographics_1_view.d_adr2_ka7, dbo.demographics_1_view.d_adr3_ka7, dbo.demographics_1_view.d_adr4_ka7, 
                         dbo.demographics_1_view.d_city_ka7, dbo.demographics_1_view.d_stte_ka7, dbo.demographics_1_view.d_zipc_ka7, dbo.demographics_1_view.d_cntr_ka7, dbo.demographics_1_view.d_attn_ka7, 
                         dbo.demographics_1_view.d_phon_ka7, dbo.demographics_1_view.d_faxn_ka7, dbo.demographics_1_view.d_emal_ka7, dbo.demographics_1_view.d_cell_ka7
FROM            dbo.demographics_1_view LEFT OUTER JOIN
                         dbo.k31_tab ON dbo.demographics_1_view.idnk12_k12 = dbo.k31_tab.idnk12_k31












