-- dbo.vendor_quote_5a_view



/* view vendor_quote_5a_view: add view */


/* view vendor_quote_5a_view: add view */


/* view vendor_quote_5a_view: add view */
CREATE VIEW dbo.vendor_quote_5a_view
AS
SELECT DISTINCT 
                         dbo.vendor_quote_3a_view.rfq_no_k42, dbo.vendor_quote_3a_view.partno_k08, dbo.vendor_quote_3a_view.p_cage_k08, dbo.vendor_quote_3a_view.p_desc_k08, dbo.vendor_quote_3a_view.fsc_k08, 
                         dbo.vendor_quote_3a_view.niin_k08, dbo.vendor_quote_3a_view.p_cage_k56, dbo.vendor_quote_3a_view.partno_k56, dbo.vendor_quote_3a_view.qotdte_k55, dbo.vendor_quote_3a_view.p_um_k56, 
                         dbo.vendor_quote_3a_view.su_lbs_k56, dbo.vendor_quote_3a_view.s_code_k39, dbo.vendor_quote_3a_view.e_name_k12, dbo.vendor_quote_3a_view.idnk55_k55, dbo.vendor_quote_3a_view.idnk56_k56, 
                         dbo.vendor_quote_3a_view.p_note_k56, dbo.vendor_quote_3a_view.qfactr_k56, dbo.vendor_quote_3a_view.q_type_k56, dbo.vendor_quote_3a_view.q_note_k55, dbo.vendor_quote_3a_view.uptime_k56, 
                         dbo.vendor_quote_3a_view.upname_k56, dbo.vendor_quote_3a_view.idnk39_k39, dbo.vendor_quote_3a_view.idnk08_k08, dbo.vendor_quote_3a_view.idnk12_k12, dbo.vendor_quote_3a_view.idnk42_k42, 
                         dbo.vendor_quote_3a_view.idnk43_k43, dbo.vendor_quote_3a_view.addtme_k42, dbo.vendor_quote_3a_view.rfquno_k42, dbo.vendor_quote_3a_view.rqpsta_k43, dbo.vendor_quote_3a_view.rqptme_k43, K34_tab.uptime_k34, 
                         K34_tab.idnk34_k34, dbo.vendor_quote_3a_view.rrqsta_k42, dbo.vendor_quote_3a_view.itmcnt_k42, dbo.vendor_quote_3a_view.uptime_k42, dbo.vendor_quote_3a_view.qrefno_k55, dbo.k10_tab.sol_no_k10, 
                         dbo.vendor_quote_3a_view.spncge_k40, dbo.vendor_quote_3a_view.spnnum_k40, dbo.vendor_quote_3a_view.idnk40_k40
FROM            dbo.k34_tab AS K34_tab RIGHT OUTER JOIN
                         dbo.k11_tab AS K11_tab INNER JOIN
                         dbo.k10_tab ON K11_tab.idnk10_k11 = dbo.k10_tab.idnk10_k10 ON K34_tab.idnk11_k34 = K11_tab.idnk11_k11 RIGHT OUTER JOIN
                         dbo.vendor_quote_3a_view LEFT OUTER JOIN
                         dbo.k45_tab ON dbo.vendor_quote_3a_view.idnk43_k43 = dbo.k45_tab.idnk43_k45 LEFT OUTER JOIN
                         dbo.k37_tab AS K37_tab ON dbo.k45_tab.idnk37_k45 = K37_tab.idnk37_k37 ON K11_tab.idnk11_k11 = K37_tab.idnvrq_k37
WHERE        (K37_tab.vrqtyp_k37 = 'k11')



