-- dbo.demographics_1_view



/* view demographics_1_view: add view */


/* view demographics_1_view: add view */


/* view demographics_1_view: add view */

/* view demographics_1_view: add view */


/* view demographics_1_view: add view */


/* view demographics_1_view: add view */


/* view demographics_1_view: add view */


/* view demographics_1_view: add view */


/* view demographics_1_view: add view */


/* view demographics_1_view: add view */
/* view demographics_1_view: add view 
 view demographics_1_view: add view 
 view demographics_1_view: add view 
 view demographics_1_view: add view 
 view demographics_1_view: add view 
 view demographics_1_view: add view 
 view demographics_1_view: add view 
 view demographics_1_view: add view */
CREATE VIEW [dbo].[demographics_1_view]
AS
SELECT        dbo.k12_tab.idnk12_k12, dbo.k12_tab.uptime_k12, dbo.k12_tab.upname_k12, dbo.k12_tab.e_code_k12, dbo.k12_tab.e_name_k12, dbo.k12_tab.e_fnam_k12, dbo.k12_tab.e_phon_k12, dbo.k12_tab.e_faxn_k12, 
                         dbo.k12_tab.e_attn_k12, dbo.k12_tab.e_emal_k12, dbo.k12_tab.e_madr_k12, dbo.k12_tab.e_note_k12, dbo.ka7_tab.idnka7_ka7, dbo.ka7_tab.uptime_ka7, dbo.ka7_tab.idnk12_ka7, dbo.ka7_tab.gduset_ka7, 
                         dbo.ka7_tab.frozen_ka7, dbo.ka7_tab.d_code_ka7, dbo.ka7_tab.d_name_ka7, dbo.ka7_tab.d_nam2_ka7, dbo.ka7_tab.d_nam3_ka7, dbo.ka7_tab.d_adr1_ka7, dbo.ka7_tab.d_adr2_ka7, dbo.ka7_tab.d_adr3_ka7, 
                         dbo.ka7_tab.d_adr4_ka7, dbo.ka7_tab.d_city_ka7, dbo.ka7_tab.d_stte_ka7, dbo.ka7_tab.d_zipc_ka7, dbo.ka7_tab.d_cntr_ka7, dbo.ka7_tab.d_attn_ka7, dbo.ka7_tab.d_phon_ka7, dbo.ka7_tab.d_faxn_ka7, 
                         dbo.ka7_tab.d_emal_ka7, dbo.ka7_tab.d_cell_ka7, dbo.k12_tab.homurl_k12, dbo.k12_tab.e_desc_k12
FROM            dbo.k12_tab INNER JOIN
                         dbo.ka7_tab ON dbo.k12_tab.idnk12_k12 = dbo.ka7_tab.idnk12_ka7










